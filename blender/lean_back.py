"""Make a character lean back in a clip.

The spine is tipped back about the character's side-to-side axis, a little at
each of Spine, Spine1 and Spine2 so the back curves rather than hinges, with
the hips fixed. Everything above the spine (arms, head) goes with it, so hands
come back from the table and cards. The neck and head tip forward again by
`head_keeps` so the character doesn't end up staring at the sky.

The lean fades in over the first `fade_frames` of the clip and out over the
last, so it joins the clips before and after it. Only the spine, neck and head
quaternion keys change.

Run after adjust_thumbs_up_reach and limit_feet_floor, then run
keep_hands_above_thighs again: the lean moves the hands, so thigh clearance
needs re-checking. Safe to re-run while tuning: the first run stores each
clip's original keys on its action (`lean_back_original`) and every run starts
from those. `restore()` puts them back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import lean_back as l; importlib.reload(l)
    l.run('demon', degrees=12, clips=['thumbsUp'])

It does not save the file.
"""
import bpy
import json
import math
from mathutils import Quaternion, Vector

KEY = 'lean_back_original'
# The share of the lean each bone takes. The neck and head turn the other way.
SPINE = {'mixamorig:Spine': .3, 'mixamorig:Spine1': .35, 'mixamorig:Spine2': .35}
HEAD = ('mixamorig:Neck', 'mixamorig:Head')


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
    """Put every clip's spine, neck and head keys back to how they were."""
    rig = bpy.data.objects[character + '-rig']
    for track in rig.animation_data.nla_tracks:
        strip = track.strips[0]
        if KEY in strip.action:
            _write(rig, _bag(strip), json.loads(strip.action[KEY]))
            del strip.action[KEY]
    print('Restored', character)


def _smooth(x):
    x = max(0, min(1, x))
    return x * x * (3 - 2 * x)


def run(character='demon', degrees=12, clips=None, fade_frames=12, head_keeps=.4):
    """degrees: how far the upper body leans back at most (negative leans
    forward). clips: names of clips to change; default is all of them.
    fade_frames: frames at each end of the clip over which the lean fades.
    head_keeps: the share of the lean the head keeps; the rest is tipped
    forward again (1 = head leans with the body, 0 = head stays level)."""
    rig = bpy.data.objects[character + '-rig']
    scene = bpy.context.scene
    frame = scene.frame_current
    world = rig.matrix_world
    to_rig = world.inverted().to_3x3()
    up = (to_rig @ Vector((0, 0, 1))).normalized()
    bones = list(SPINE) + list(HEAD)
    head_share = (1 - head_keeps) / len(HEAD)
    shares = {**SPINE, **{b: -head_share for b in HEAD}}

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
        samples = {b: [] for b in bones}
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            across = to_rig @ (world.to_3x3() @ (pose['mixamorig:RightUpLeg'].head - pose['mixamorig:LeftUpLeg'].head))
            across = (across - up * across.dot(up)).normalized()
            thighs = sum(((pose['mixamorig:' + s + 'UpLeg'].tail - pose['mixamorig:' + s + 'UpLeg'].head)
                          for s in ('Left', 'Right')), Vector())
            forward = (thighs - up * thighs.dot(up)).normalized()
            # Turn the right way: a positive angle must move the head back.
            pivot = pose['mixamorig:Spine'].head
            top = pose['mixamorig:Head'].head - pivot
            moved = (Quaternion(across, .01) @ top - top).dot(forward)
            sign = -1 if moved > 0 else 1

            fade = min(_smooth((f - start) / max(1, fade_frames)), _smooth((end - f) / max(1, fade_frames)))
            lean = math.radians(degrees) * sign * fade
            for bone in bones:
                b = pose[bone]
                before = b.parent.matrix.to_quaternion() @ (
                    b.parent.bone.matrix_local.inverted() @ b.bone.matrix_local).to_quaternion()
                axis = before.inverted() @ across
                local = Quaternion(axis, lean * shares[bone]) @ b.rotation_quaternion
                samples[bone].append(local)
        for bone in bones:
            previous = None
            for j, q in enumerate(samples[bone]):
                if previous is not None:
                    q.make_compatible(previous)
                previous = q.copy()
                for axis_index, curve in enumerate(keys[bone]):
                    _set_key(curve.keyframe_points[j], q[axis_index])
            for curve in keys[bone]:
                curve.update()
        print('%s: leaned back %s degrees' % (track.name, degrees))
    scene.frame_set(frame)
