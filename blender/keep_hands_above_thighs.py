"""Lift hands that sink into the thighs.

Each frame, if a wrist is over a thigh (between hip and knee) and closer to the
thigh's centre line than `clearance`, the wrist is raised until it is
`clearance` above it, fading out as the hand moves off the thigh. The arm is
re-solved with the two-bone solve used by adjust_resting_hands, keeping the
elbow's direction and the hand's world orientation. Only upper-arm, forearm and
hand quaternion keys change.

Run it after adjust_thumbs_up_reach and limit_feet_floor: it measures the thighs
as they are then. Safe to re-run while tuning: the first run stores each clip's
current arm keys on its action (`hand_clearance_original`) and every run starts
from those. `restore()` puts them back. If you re-run adjust_thumbs_up_reach on
a character, run restore() first, then this again afterwards.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import keep_hands_above_thighs as h; importlib.reload(h)
    h.run('blind-wizard', clips=['disapproval', 'thumbsUp'])

It does not save the file.
"""
import bpy
import json
import math
from mathutils import Vector

KEY = 'hand_clearance_original'
PARTS = ('Arm', 'ForeArm', 'Hand')


def _bag(strip):
    return strip.action.layers[0].strips[0].channelbag(strip.action_slot)


def _curves(rig, bag, bone):
    path = rig.pose.bones[bone].path_from_id('rotation_quaternion')
    curves = sorted([c for c in bag.fcurves if c.data_path == path], key=lambda c: c.array_index)
    assert len(curves) == 4, bone
    return curves


def _set_key(key, value):
    delta = value - key.co.y
    key.co.y += delta
    key.handle_left.y += delta
    key.handle_right.y += delta


def _write(rig, bag, values):
    for bone, rows in values.items():
        for curve, ys in zip(_curves(rig, bag, bone), rows):
            for key, y in zip(curve.keyframe_points, ys):
                _set_key(key, y)
            curve.update()


def _smooth(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


def restore(character='blind-wizard'):
    """Put every clip's arm keys back to how they were before the first run."""
    rig = bpy.data.objects[character + '-rig']
    for track in rig.animation_data.nla_tracks:
        strip = track.strips[0]
        if KEY in strip.action:
            _write(rig, _bag(strip), json.loads(strip.action[KEY]))
            del strip.action[KEY]
    print('Restored', character)


def run(character='blind-wizard', clearance=.09, clips=None, sides=('Left', 'Right'), allow_lower=False):
    """clearance: how far above a thigh's centre line a wrist must stay, in
    world units (resting hands sit at about .075 to .11).
    clips: names of clips to correct; default is all of them.
    allow_lower: also bring hands that sit higher than `clearance` down to it,
    where they're over a thigh (for a character whose resting hands float)."""
    rig = bpy.data.objects[character + '-rig']
    scene = bpy.context.scene
    frame = scene.frame_current
    world = rig.matrix_world
    to_rig = world.inverted().to_3x3()
    up = (to_rig @ Vector((0, 0, 1))).normalized()
    bones = ['mixamorig:' + s + p for s in sides for p in PARTS]

    for track in rig.animation_data.nla_tracks:
        if clips and track.name not in clips:
            continue
        strip = track.strips[0]
        action, bag = strip.action, _bag(strip)
        keys = {b: _curves(rig, bag, b) for b in bones}
        if KEY not in action:
            action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in keys[b]] for b in bones})
        _write(rig, bag, json.loads(action[KEY]))

        start, end = map(int, action.frame_range)
        assert len(keys[bones[0]][0].keyframe_points) == end - start + 1, 'Expected one key per frame'
        samples = {}
        biggest = 0
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            for side in sides:
                arm, forearm, hand = [pose['mixamorig:' + side + p] for p in PARTS]
                hip, knee = pose['mixamorig:' + side + 'UpLeg'].head, pose['mixamorig:' + side + 'Leg'].head
                shoulder, elbow, wrist = arm.head.copy(), forearm.head.copy(), hand.head.copy()

                along = (hip - knee)
                t = max(0, min(1, (wrist - hip).dot(knee - hip) / (knee - hip).length_squared))
                nearest = hip + (knee - hip) * t
                offset = wrist - nearest
                height = offset.dot(up)
                sideways = (offset - up * height).length * world.to_scale().x
                lift = clearance - height * world.to_scale().x
                if not allow_lower:
                    lift = max(0, lift)
                # Only where the hand is over the thigh, not off its end or side.
                weight = _smooth((t - .05) / .15) * _smooth((1.15 - t) / .15) * _smooth(1 - sideways / (clearance * 1.6))
                shift = lift * weight / world.to_scale().x
                biggest = max(biggest, abs(shift) * world.to_scale().x)
                target = wrist + up * shift

                l1, l2 = (elbow - shoulder).length, (wrist - elbow).length
                delta = target - shoulder
                distance = max(.0001, min(delta.length, (l1 + l2) * .999))
                axis = delta.normalized()
                target = shoulder + axis * distance
                pole = elbow - shoulder - axis * (elbow - shoulder).dot(axis)
                pole = pole.normalized() if pole.length > 1e-5 else axis.cross(up).normalized()
                reach = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
                new_elbow = shoulder + axis * reach + pole * math.sqrt(max(0, l1 * l1 - reach * reach))
                qa = (elbow - shoulder).rotation_difference(new_elbow - shoulder) @ arm.matrix.to_quaternion()
                qb = (wrist - elbow).rotation_difference(target - new_elbow) @ forearm.matrix.to_quaternion()
                parent = arm.parent.matrix.to_quaternion()
                for bone, desired in ((arm, qa), (forearm, qb), (hand, hand.matrix.to_quaternion())):
                    rest = bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
                    samples.setdefault(bone.name, []).append(
                        rest.to_quaternion().inverted() @ parent.inverted() @ desired)
                    parent = desired
        for bone in bones:
            previous = None
            for j, q in enumerate(samples[bone]):
                if previous is not None:
                    q.make_compatible(previous)
                previous = q.copy()
                for axis, curve in enumerate(keys[bone]):
                    _set_key(curve.keyframe_points[j], q[axis])
            for curve in keys[bone]:
                curve.update()
        print('%s: hands moved by up to %.3f' % (track.name, biggest))
    scene.frame_set(frame)
