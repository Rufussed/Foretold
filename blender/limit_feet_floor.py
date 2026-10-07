"""Keep a character's feet from going below a floor height, in every clip.

Each frame, if the lowest of a leg's foot points (foot, toe base, toe end)
is below `floor`, that thigh is rotated about the hip, around the line
between the two hips, just far enough to bring it back to the floor. The
shin and foot keep their own rotation relative to the thigh, so they move
with it. Only the two upper-leg quaternion keys change.

Safe to re-run while tuning: the first run stores each clip's original thigh
keys on its action (`feet_floor_original`) and every run starts from those,
so nothing stacks. `restore()` puts them back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import limit_feet_floor as f; importlib.reload(f)
    f.run('forest-elf', floor=0.0)

It does not save the file.
"""
import bpy
import json
import math
from mathutils import Quaternion, Vector

KEY = 'feet_floor_original'
POINTS = ('Foot', 'ToeBase', 'Toe_End')
THIGHS = ('mixamorig:LeftUpLeg', 'mixamorig:RightUpLeg')


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


def restore(character='forest-elf'):
    """Put every clip's original thigh keys back."""
    rig = bpy.data.objects[character + '-rig']
    for track in rig.animation_data.nla_tracks:
        strip = track.strips[0]
        if KEY in strip.action:
            _write(rig, _bag(strip), json.loads(strip.action[KEY]))
            del strip.action[KEY]
    print('Restored', character)


def _lowest(rig, side):
    world = rig.matrix_world
    return min((world @ rig.pose.bones['mixamorig:' + side + p].head).z for p in POINTS)


def run(character='forest-elf', floor=0.0, max_degrees=45, clips=None):
    """floor: world height the feet must stay above (scene units).
    max_degrees: the most a thigh may be turned in one frame.
    clips: names of clips to correct; default is all of them."""
    rig = bpy.data.objects[character + '-rig']
    scene = bpy.context.scene
    frame = scene.frame_current
    world = rig.matrix_world
    to_world = world.to_3x3()
    up = Vector((0, 0, 1))
    step = math.radians(.25)
    steps = int(math.radians(max_degrees) / step)

    for track in rig.animation_data.nla_tracks:
        if clips and track.name not in clips:
            continue
        strip = track.strips[0]
        action, bag = strip.action, _bag(strip)
        keys = {b: _curves(rig, bag, b) for b in THIGHS}
        if KEY not in action:
            action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in keys[b]] for b in THIGHS})
        _write(rig, bag, json.loads(action[KEY]))

        start, end = map(int, action.frame_range)
        assert len(keys[THIGHS[0]][0].keyframe_points) == end - start + 1, 'Expected one key per frame'
        samples = {b: [] for b in THIGHS}
        worst = 0
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            hips = pose[THIGHS[1]].head - pose[THIGHS[0]].head
            across = to_world @ hips
            across = (across - up * across.dot(up)).normalized()
            for bone, side in zip(THIGHS, ('Left', 'Right')):
                thigh = pose[bone]
                hip = world @ thigh.head
                points = [world @ pose['mixamorig:' + side + p].head - hip for p in POINTS]
                base = _lowest(rig, side)
                turn = 0.0
                if base < floor:
                    # Try turning each way a quarter degree at a time; keep the
                    # smaller turn that gets every foot point to the floor.
                    best = None
                    for sign in (1, -1):
                        for i in range(1, steps + 1):
                            q = Quaternion(across, sign * i * step)
                            if min((hip + q @ p).z for p in points) >= floor:
                                if best is None or i * step < abs(best):
                                    best = sign * i * step
                                break
                    turn = best if best is not None else 0.0
                    worst = max(worst, abs(math.degrees(turn)))
                armature_q = thigh.matrix.to_quaternion()
                if turn:
                    # The turn is about a world axis; thigh.matrix is in armature space.
                    axis = world.to_3x3().inverted() @ across
                    armature_q = Quaternion(axis.normalized(), turn) @ armature_q
                rest = thigh.parent.bone.matrix_local.inverted() @ thigh.bone.matrix_local
                parent_q = thigh.parent.matrix.to_quaternion()
                samples[bone].append(rest.to_quaternion().inverted() @ parent_q.inverted() @ armature_q)
        for bone in THIGHS:
            previous = None
            for j, q in enumerate(samples[bone]):
                if previous is not None:
                    q.make_compatible(previous)
                previous = q.copy()
                for axis, curve in enumerate(keys[bone]):
                    _set_key(curve.keyframe_points[j], q[axis])
            for curve in keys[bone]:
                curve.update()
        print('%s: thighs turned up to %.1f degrees' % (track.name, worst))
    scene.frame_set(frame)
