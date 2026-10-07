"""Roll the wrists back so the hands point less far down.

Each frame, each hand is turned about the line between the character's hips
(its side-to-side axis) by `degrees`, so the fingertips come up and forward
while the wrist stays where it is. Fingers move with the hand, keeping their
own keys. Only the two hand quaternion keys change.

Run it after keep_hands_above_thighs: that script re-solves the hands and
would undo this one. Safe to re-run while tuning: the first run stores each
clip's hand keys on its action (`hand_tilt_original`) and every run starts from
those. `restore()` puts them back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import tilt_hands_back as t; importlib.reload(t)
    t.run('demon', degrees=30, clips=['idleTwitchy'])

It does not save the file.
"""
import bpy
import json
import math
from mathutils import Quaternion, Vector

KEY = 'hand_tilt_original'
HANDS = ('mixamorig:LeftHand', 'mixamorig:RightHand')


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


def restore(character='demon'):
    """Put every clip's hand keys back to how they were before the first run."""
    rig = bpy.data.objects[character + '-rig']
    for track in rig.animation_data.nla_tracks:
        strip = track.strips[0]
        if KEY in strip.action:
            _write(rig, _bag(strip), json.loads(strip.action[KEY]))
            del strip.action[KEY]
    print('Restored', character)


def run(character='demon', degrees=30, clips=None):
    """degrees: how far to roll each hand back, fingertips up. Negative rolls
    them the other way. clips: names of clips to change; default is all."""
    rig = bpy.data.objects[character + '-rig']
    scene = bpy.context.scene
    frame = scene.frame_current
    world = rig.matrix_world
    to_rig = world.inverted().to_3x3()
    turn = math.radians(degrees)

    for track in rig.animation_data.nla_tracks:
        if clips and track.name not in clips:
            continue
        strip = track.strips[0]
        action, bag = strip.action, _bag(strip)
        keys = {b: _curves(rig, bag, b) for b in HANDS}
        if KEY not in action:
            action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in keys[b]] for b in HANDS})
        _write(rig, bag, json.loads(action[KEY]))

        start, end = map(int, action.frame_range)
        assert len(keys[HANDS[0]][0].keyframe_points) == end - start + 1, 'Expected one key per frame'
        samples = {b: [] for b in HANDS}
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            across = pose['mixamorig:RightUpLeg'].head - pose['mixamorig:LeftUpLeg'].head
            across = to_rig @ ((world.to_3x3() @ across) * Vector((1, 1, 0)))
            across.normalize()
            for bone in HANDS:
                hand = pose[bone]
                side = bone.split('Hand')[0].replace('mixamorig:', '')
                fingers = pose['mixamorig:' + side + 'HandMiddle1'].head - hand.head
                # Pick the turn direction that lifts the fingertips.
                up = (to_rig @ Vector((0, 0, 1)))
                lift = (Quaternion(across, .01) @ fingers).dot(up) - fingers.dot(up)
                signed = turn if lift > 0 else -turn
                q = Quaternion(across, signed) @ hand.matrix.to_quaternion()
                rest = hand.parent.bone.matrix_local.inverted() @ hand.bone.matrix_local
                samples[bone].append(rest.to_quaternion().inverted() @ hand.parent.matrix.to_quaternion().inverted() @ q)
        for bone in HANDS:
            previous = None
            for j, q in enumerate(samples[bone]):
                if previous is not None:
                    q.make_compatible(previous)
                previous = q.copy()
                for axis, curve in enumerate(keys[bone]):
                    _set_key(curve.keyframe_points[j], q[axis])
            for curve in keys[bone]:
                curve.update()
        print('%s: hands rolled back %s degrees' % (track.name, degrees))
    scene.frame_set(frame)
