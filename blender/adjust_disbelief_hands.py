"""Bring the hands closer together where a character's disbelief clip holds them to the head.

Each frame, while both wrists are within reach of the head, the wrists are set
`spacing` apart about their midpoint and moved `forward` in front of where the
face points, fading in as the hands come up and out as they come down. Both are
per character (SETTINGS below): spacing to bring the hands together, forward to
keep them clear of a bigger head.
The arm is re-solved with the same two-bone solve as adjust_resting_hands, so
the elbows follow; the hands keep their world orientation and every finger key
is untouched. Only upper-arm, forearm and hand quaternion keys change.

Safe to re-run while tuning: the first run stores the clip's original keys on
the action (`disbelief_hands_original`) and every run starts from those, so
corrections never stack. `restore()` puts the original keys back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import adjust_disbelief_hands as d; importlib.reload(d)
    d.run('goatman')                     # SETTINGS['goatman']
    d.run('demon', spacing=.18, forward=.03)   # try values, then copy into SETTINGS

It does not save the file; save (or call restore) once happy.
"""
import bpy
import json
import math
from mathutils import Vector

from adjust_thumbs_up_reach import _clip, _curves, _set_key

KEY = 'disbelief_hands_original'
CLIP = 'disbelief'
PARTS = ('Arm', 'ForeArm', 'Hand')
SIDES = ('Left', 'Right')
BONES = ['mixamorig:' + side + part for side in SIDES for part in PARTS]

# Per character, scene units (metres, before the seat's 3x scale):
#   spacing: wrist-to-wrist distance while the hands are held to the head;
#   forward: how far in front of the head (along where the face points) they sit.
SETTINGS = {
    'goatman': dict(spacing=.16, forward=0),
    'forest-elf': dict(spacing=.12, forward=.10),
    'blind-wizard': dict(spacing=.20, forward=.07),
    'black-witch': dict(spacing=.06, forward=0),
    'kungfu-girl': dict(spacing=.08, forward=0),
    'demon': dict(spacing=.19, forward=.16),
}
DEFAULT = dict(spacing=.18, forward=0)


def restore(character='goatman'):
    """Put the clip's original arm keys back."""
    rig = bpy.data.objects[character + '-rig']
    _, action, bag = _clip(rig, CLIP)
    if KEY not in action:
        print('Nothing to restore: clip is untouched.')
        return
    _write_original(rig, bag, json.loads(action[KEY]))
    del action[KEY]
    print('Restored', character, CLIP)


def _write_original(rig, bag, original):
    for bone, values in original.items():
        for curve, ys in zip(_curves(rig, bag, bone), values):
            for key, y in zip(curve.keyframe_points, ys):
                _set_key(key, y)
            curve.update()


def _smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def _solve(shoulder, elbow, wrist, target, up):
    """Two-bone arm solve: new elbow and wrist, keeping the elbow's bend plane."""
    l1, l2 = (elbow - shoulder).length, (wrist - elbow).length
    delta = target - shoulder
    distance = max(.0001, min(delta.length, (l1 + l2) * .999))
    axis = delta.normalized()
    pole = elbow - shoulder - axis * (elbow - shoulder).dot(axis)
    if pole.length < 1e-5:
        pole = axis.cross(up)
    pole.normalize()
    along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
    new_elbow = shoulder + axis * along + pole * math.sqrt(max(0, l1 * l1 - along * along))
    return new_elbow, shoulder + axis * distance


def _face_axis(rig, start, strip, world):
    """The head's forward direction in its own axes, from the clip's first frame,
    where the seated thighs point forward."""
    scene = bpy.context.scene
    scene.frame_set(int(strip.frame_start + start - strip.action_frame_start))
    pose = rig.pose.bones
    up = (world.inverted().to_3x3() @ Vector((0, 0, 1))).normalized()
    thighs = sum(((pose['mixamorig:' + s + 'UpLeg'].tail - pose['mixamorig:' + s + 'UpLeg'].head)
                  for s in SIDES), Vector())
    forward = (thighs - up * thighs.dot(up)).normalized()
    return (pose['mixamorig:Head'].matrix.to_3x3().inverted() @ forward).normalized()


def run(character='goatman', spacing=None, forward=None, near=.25, far=.35):
    """spacing / forward: override SETTINGS for this run (scene units).
    near / far: wrist-to-head distance, scene units, below which the change is
    full and above which it is off, for whichever hand is further away."""
    settings = {**DEFAULT, **SETTINGS.get(character, {})}
    spacing = settings['spacing'] if spacing is None else spacing
    forward = settings['forward'] if forward is None else forward
    assert spacing >= 0 and far > near
    rig = bpy.data.objects[character + '-rig']
    strip, action, bag = _clip(rig, CLIP)
    keys = {b: _curves(rig, bag, b) for b in BONES}

    # Always solve from the original keys.
    if KEY not in action:
        action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in keys[b]] for b in BONES})
    _write_original(rig, bag, json.loads(action[KEY]))

    scene = bpy.context.scene
    frame = scene.frame_current
    start, end = map(int, action.frame_range)
    assert len(keys[BONES[0]][0].keyframe_points) == end - start + 1, 'Expected one key per frame'
    world = rig.matrix_world.copy()
    up = (world.inverted().to_3x3() @ Vector((0, 0, 1))).normalized()
    unit = 1 / world.to_scale().x  # scene units to rig units
    samples, peak = [], 0.0
    try:
        face = _face_axis(rig, start, strip, world)
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            head = world @ pose['mixamorig:Head'].head
            arms = {side: [pose['mixamorig:' + side + part] for part in PARTS] for side in SIDES}
            wrists = {side: arms[side][2].head.copy() for side in SIDES}
            reach = max((world @ wrists[side] - head).length for side in SIDES)
            weight = 1 - _smoothstep((reach - near) / (far - near))
            peak = max(peak, weight)
            middle = (wrists['Left'] + wrists['Right']) / 2
            ahead = (pose['mixamorig:Head'].matrix.to_3x3() @ face).normalized() * forward * unit
            changes = {}
            for side in SIDES:
                arm, forearm, hand = arms[side]
                shoulder, elbow, wrist = arm.head.copy(), forearm.head.copy(), wrists[side]
                goal = middle + (wrist - middle).normalized() * (spacing * unit / 2) + ahead
                new_elbow, new_wrist = _solve(shoulder, elbow, wrist, wrist.lerp(goal, weight), up)
                qa = (elbow - shoulder).rotation_difference(new_elbow - shoulder) @ arm.matrix.to_quaternion()
                qb = (wrist - elbow).rotation_difference(new_wrist - new_elbow) @ forearm.matrix.to_quaternion()
                parent = arm.parent.matrix.to_quaternion()
                for bone, desired in ((arm, qa), (forearm, qb), (hand, hand.matrix.to_quaternion())):
                    rest = bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
                    changes[bone.name] = rest.to_quaternion().inverted() @ parent.inverted() @ desired
                    parent = desired
            samples.append(changes)
    finally:
        scene.frame_set(frame)

    for b in BONES:
        previous = None
        for j, sample in enumerate(samples):
            q = sample[b]
            if previous is not None:
                q.make_compatible(previous)
            previous = q.copy()
            for axis, curve in enumerate(keys[b]):
                _set_key(curve.keyframe_points[j], q[axis])
        for curve in keys[b]:
            curve.update()
    scene.frame_set(frame)
    print(f'Applied {character} {CLIP}: spacing {spacing}, forward {forward} (peak weight {peak:.2f})')
