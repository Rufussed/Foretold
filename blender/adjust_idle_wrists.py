"""Turn the hands about the forearm so they lie flatter on the thighs in the idles.

Each hand turns `twist` degrees about its own forearm's axis, the right hand
one way and the left mirrored, so palms resting on the thighs flatten instead
of digging their edges in. The forearm doesn't move, so this is one constant
rotation applied to every hand key; the fingers ride along, and nothing else
changes. Tune the sign by eye per character (forest elf wanted -15).

`bend` then tips each hand at the wrist, about the axis across its own palm
(index knuckle to pinky knuckle), mirrored like twist so both hands bend the
same way.

Safe to re-run while tuning: the first run stores the clip's original hand keys
on the action (`idle_wrists_original`) and every run starts from those, so
corrections never stack. `restore()` puts the original keys back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import adjust_idle_wrists as w; importlib.reload(w)
    w.run('forest-elf')                 # SETTINGS['forest-elf']
    w.run('goatman', twist=10, bend=5)  # try values, then copy into SETTINGS

It does not save the file; save (or call restore) once happy.
"""
import bpy
import json
import math
from mathutils import Quaternion

from adjust_thumbs_up_reach import _clip, _curves, _set_key

KEY = 'idle_wrists_original'
CLIPS = ('idle', 'idleTwitchy')  # both clips get the same settings
# Right hand turns +twist about its forearm's axis, the left -twist (mirrored).
SIDES = {'Right': 1, 'Left': -1}

# Degrees, per character. A clip name holds overrides for that clip only, and a
# side ('Left' / 'Right'), at either level, for that hand only.
SETTINGS = {
    'forest-elf': dict(twist=-15, bend=5),
    'blind-wizard': dict(twist=-10, bend=5,
                         idleTwitchy=dict(twist=-15, bend=23, Right=dict(twist=-20, bend=27))),
    'black-witch': dict(twist=-5, bend=5),
    'goatman': dict(twist=-10, bend=5, idle=dict(bend=15, Right=dict(twist=-15), Left=dict(bend=10))),
    'kungfu-girl': dict(twist=-5, bend=5),
}
DEFAULT = dict(twist=0, bend=0)


def _original(rig, action, bag):
    bones = ['mixamorig:' + side + 'Hand' for side in SIDES]
    if KEY not in action:
        action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in _curves(rig, bag, b)]
                                  for b in bones})
    return json.loads(action[KEY])


def _write(rig, bag, bone, rows):
    previous = None
    curves = _curves(rig, bag, bone)
    for j in range(len(rows[0])):
        q = Quaternion([rows[axis][j] for axis in range(4)])
        if previous is not None:
            q.make_compatible(previous)
        previous = q.copy()
        for axis, curve in enumerate(curves):
            _set_key(curve.keyframe_points[j], q[axis])
    for curve in curves:
        curve.update()


def restore(character='forest-elf'):
    """Put the clip's original hand keys back."""
    rig = bpy.data.objects[character + '-rig']
    for clip in CLIPS:
        _, action, bag = _clip(rig, clip)
        if KEY not in action:
            print('Nothing to restore:', clip, 'is untouched.')
            continue
        for bone, rows in json.loads(action[KEY]).items():
            _write(rig, bag, bone, rows)
        del action[KEY]
        print('Restored', character, clip)


def _palm_axis(rig, side):
    """Index knuckle to pinky knuckle (ring if there's no pinky), in the hand's own rest frame."""
    bones = rig.data.bones
    hand = bones['mixamorig:' + side + 'Hand']
    outer = bones.get('mixamorig:' + side + 'HandPinky1') or bones['mixamorig:' + side + 'HandRing1']
    across = outer.head_local - bones['mixamorig:' + side + 'HandIndex1'].head_local
    return (hand.matrix_local.to_quaternion().inverted() @ across).normalized()


def run(character='forest-elf', twist=None, bend=None):
    """twist / bend: degrees, overriding SETTINGS (every clip) for this run."""
    entry = SETTINGS.get(character, {})
    rig = bpy.data.objects[character + '-rig']
    for clip in CLIPS:
        angles = {}
        for side in SIDES:
            settings = {**DEFAULT, **entry, **entry.get(clip, {})}
            settings.update(settings.get(side, {}))
            angles[side] = (settings['twist'] if twist is None else twist,
                            settings['bend'] if bend is None else bend)
        _apply(rig, clip, angles)
        print(f'Applied {character} {clip}: ' +
              ', '.join(f'{side} twist {t}° bend {b}°' for side, (t, b) in angles.items()))


def _apply(rig, clip, angles):
    """angles: side -> (twist, bend) in degrees."""
    _, action, bag = _clip(rig, clip)
    original = _original(rig, action, bag)
    for side, sign in SIDES.items():
        twist, bend = angles[side]
        hand = rig.data.bones['mixamorig:' + side + 'Hand']
        # The hand's rest rotation in its forearm's frame; the forearm's own Y is its axis.
        local = (hand.parent.matrix_local.inverted() @ hand.matrix_local).to_quaternion()
        turn = local.inverted() @ Quaternion((0, 1, 0), math.radians(twist * sign)) @ local
        # Index-to-pinky points outward on both hands, i.e. opposite ways, so mirror the sign.
        tip = Quaternion(_palm_axis(rig, side), math.radians(bend * sign))  # in the hand's own frame
        rows = original[hand.name]
        turned = [turn @ Quaternion([rows[axis][j] for axis in range(4)]) @ tip for j in range(len(rows[0]))]
        _write(rig, bag, hand.name, [[q[axis] for q in turned] for axis in range(4)])
