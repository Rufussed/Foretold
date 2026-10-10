"""Shorten how far forward the arms reach in a character's thumbsUp clip.

Each frame, the wrist's forward distance from the shoulder is scaled by
`forward_scale` and the arm re-solved with the same two-bone solve as
adjust_resting_hands, so the elbow bends more instead of extending. The hand's
world orientation and all finger keys are kept; only upper-arm, forearm and
hand quaternion keys change.

Safe to re-run while tuning: the first run stores the clip's original keys on
the action (`thumbs_up_reach_original`) and every run starts from those, so
corrections never stack. `restore()` puts the original keys back.

Run inside Blender with characters.blend open:

    import sys, importlib; sys.path.insert(0, bpy.path.abspath('//'))
    import adjust_thumbs_up_reach as r; importlib.reload(r)
    r.run('forest-elf', forward_scale=.75)

It does not save the file; save (or call restore) once happy.
"""
import bpy
import json
import math
from mathutils import Vector

KEY = 'thumbs_up_reach_original'
# Hand height above the thigh (scene units) over which the limit fades in.
LIMIT_HEIGHT = (.28, .36)
PARTS = ('Arm', 'ForeArm', 'Hand')


def _clip(rig, clip='thumbsUp'):
    track = next(t for t in rig.animation_data.nla_tracks if t.name == clip)
    strip = track.strips[0]
    action = strip.action
    return strip, action, action.layers[0].strips[0].channelbag(strip.action_slot)


def _curves(rig, bag, bone):
    path = rig.pose.bones[bone].path_from_id('rotation_quaternion')
    curves = sorted([c for c in bag.fcurves if c.data_path == path], key=lambda c: c.array_index)
    assert len(curves) == 4, bone
    return curves


def _bones(sides):
    return ['mixamorig:' + side + part for side in sides for part in PARTS]


def _set_key(key, value):
    delta = value - key.co.y
    key.co.y += delta
    key.handle_left.y += delta
    key.handle_right.y += delta


def restore(character='forest-elf'):
    """Put the clip's original arm keys back."""
    rig = bpy.data.objects[character + '-rig']
    _, action, bag = _clip(rig)
    if KEY not in action:
        print('Nothing to restore: clip is untouched.')
        return
    for bone, values in json.loads(action[KEY]).items():
        for curve, ys in zip(_curves(rig, bag, bone), values):
            for key, y in zip(curve.keyframe_points, ys):
                _set_key(key, y)
            curve.update()
    del action[KEY]
    print('Restored', character, 'thumbsUp')


def _smooth(rows, radius, reference):
    """Smooth the angle of each elbow direction around its shoulder-wrist line.

    The angle is unwrapped first, so a half-turn in a frame or two is spread
    over the window instead of being averaged through the middle."""
    if radius <= 0:
        return [r['bend'] for r in rows]
    angles, bases = [], []
    for r in rows:
        line = r['line']
        x = reference - line * reference.dot(line)
        x = x.normalized() if x.length > 1e-5 else line.orthogonal().normalized()
        y = line.cross(x)
        bases.append((x, y))
        angle = math.atan2(r['bend'].dot(y), r['bend'].dot(x))
        if angles:
            while angle - angles[-1] > math.pi:
                angle -= 2 * math.pi
            while angle - angles[-1] < -math.pi:
                angle += 2 * math.pi
        angles.append(angle)
    sigma = radius / 2
    out = []
    for i, (x, y) in enumerate(bases):
        lo, hi = max(0, i - radius), min(len(angles), i + radius + 1)
        weights = [math.exp(-((j - i) ** 2) / (2 * sigma * sigma)) for j in range(lo, hi)]
        angle = sum(w * angles[j] for w, j in zip(weights, range(lo, hi))) / sum(weights)
        out.append(x * math.cos(angle) + y * math.sin(angle))
    return out


def _smooth_directions(vectors, radius):
    """Gaussian-weighted average of unit vectors over neighbouring frames."""
    if radius <= 0:
        return list(vectors)
    sigma = radius / 2
    out = []
    for i in range(len(vectors)):
        total = Vector()
        for j in range(max(0, i - radius), min(len(vectors), i + radius + 1)):
            total += vectors[j] * math.exp(-((j - i) ** 2) / (2 * sigma * sigma))
        out.append(total.normalized())
    return out


def run(character='forest-elf', forward_scale=.8, sides=('Left', 'Right'),
        frames=None, pole_smooth=4, elbow_up_limit=-.3, shoulder_smooth=5, limit_frame=None, limit_height=None, holds=None, hold_sides=None, hold_blend=2, clip='thumbsUp'):
    """forward_scale: 1 = unchanged, .8 = wrist reaches 20% less far forward.
    sides: which arms to change. frames: optional (first, last) clip frames to
    reduce reach in. pole_smooth: radius in frames of a smoothing applied to the
    direction the elbow points around the arm, which stops the elbow flipping
    round in a frame or two where the original swings it (0 = off).
    elbow_up_limit: how far up the elbow may point, as the up-component of its
    direction (-1 straight down, 0 sideways, 1 up). The original flips the
    elbow up over a stretch of the clip; past this limit it's turned back
    toward hanging down, fully by 0.4 above it. Use 1 to leave the elbow alone.
    limit_frame: a scene frame whose forward reach is the most the arm may reach
    while raised, for each side; the clip repeats the gesture and this stops the
    repeats going further than that frame (resting hands are left alone).
    limit_height: (low, high) hand height above the thigh, scene units, over which
    the limit fades in (default LIMIT_HEIGHT). Lower it for a character whose raised
    hand doesn't get as high, or the limit only half-applies at its peaks.
    holds: list of (first, last[, source[, blend]]) scene frames; the arm keeps its
    pose at `source` (default `first`) from `first` through `last`, then eases
    back into the animation over `blend` frames (default hold_blend), e.g.
    [(938, 942, 937), (951, 958, 937)]. hold_sides: which arms hold
    (default: all of `sides`). hold_blend: frames over which the arm eases from
    the held pose back into the animation after a hold, unless it gives its own.
    shoulder_smooth: radius in frames of a smoothing of where the upper arm
    points, so the shoulder never swings fast (0 = off)."""
    assert 0 < forward_scale <= 1
    rig = bpy.data.objects[character + '-rig']
    strip, action, bag = _clip(rig, clip)
    bones = _bones(sides)
    keys = {b: _curves(rig, bag, b) for b in bones}
    count = len(keys[bones[0]][0].keyframe_points)

    # Always solve from the original keys.
    if KEY not in action:
        action[KEY] = json.dumps({b: [[k.co.y for k in c.keyframe_points] for c in keys[b]] for b in bones})
    original = json.loads(action[KEY])
    for b in bones:
        for curve, ys in zip(keys[b], original[b]):
            for key, y in zip(curve.keyframe_points, ys):
                _set_key(key, y)
            curve.update()

    scene = bpy.context.scene
    frame = scene.frame_current
    start, end = map(int, action.frame_range)
    assert count == end - start + 1, 'Expected one key per frame'
    first, last = frames or (start, end)
    world = rig.matrix_world.copy()
    to_rig = world.inverted().to_3x3()
    up = (to_rig @ Vector((0, 0, 1))).normalized()
    forward = None
    # Pass 1: read each frame's pose and decide where the wrist should be.
    data = {side: [] for side in sides}
    try:
        for f in range(start, end + 1):
            scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
            pose = rig.pose.bones
            if forward is None:
                # Seated thighs point forward: horizontal, in rig space.
                thighs = sum(((pose['mixamorig:' + s + 'UpLeg'].tail - pose['mixamorig:' + s + 'UpLeg'].head)
                              for s in ('Left', 'Right')), Vector())
                forward = (thighs - up * thighs.dot(up)).normalized()
            for side in sides:
                arm, forearm, hand = [pose['mixamorig:' + side + p] for p in PARTS]
                shoulder, elbow, wrist = arm.head.copy(), forearm.head.copy(), hand.head.copy()
                target = wrist.copy()
                if first <= f <= last:
                    reach = (wrist - shoulder).dot(forward)
                    if reach > 0:
                        target = wrist - forward * reach * (1 - forward_scale)
                # Which way the elbow points, around the shoulder-wrist line.
                line = (wrist - shoulder).normalized()
                bend = elbow - shoulder
                bend -= line * bend.dot(line)
                bend = bend.normalized() if bend.length > 1e-5 else line.cross(up).normalized()
                # An elbow pointing up is turned back toward the way it hangs.
                hang = -up - line * (-up).dot(line)
                if hang.length > .2:
                    t = max(0, min(1, (bend.dot(up) - elbow_up_limit) / .4))
                    t = t * t * (3 - 2 * t)
                    mix = bend.lerp(hang.normalized(), t)
                    bend = mix.normalized() if mix.length > 1e-5 else hang.normalized()
                height = (world @ wrist).z - (world @ pose['mixamorig:' + side + 'UpLeg'].head).z
                data[side].append(dict(
                    reach=(target - shoulder).dot(forward), height=height, forward=forward,
                    shoulder=shoulder, elbow=elbow, wrist=wrist, target=target, bend=bend, line=line,
                    qarm=arm.matrix.to_quaternion(), qfore=forearm.matrix.to_quaternion(),
                    qhand=hand.matrix.to_quaternion(), qparent=arm.parent.matrix.to_quaternion(),
                    bones=(arm, forearm, hand)))
    finally:
        scene.frame_set(frame)

    # Pass 2: smooth the elbow direction, then solve every frame.
    samples = {}
    for side in sides:
        rows = data[side]
        bends = _smooth(rows, pole_smooth, forward)
        if limit_frame is not None:
            low, high = limit_height or LIMIT_HEIGHT
            # No raised reach past the one at limit_frame: weight 1 while the
            # hand is well above the thigh, fading to 0 as it comes to rest.
            ref = rows[int(limit_frame - strip.frame_start + strip.action_frame_start) - start]['reach']
            for r in rows:
                t = max(0, min(1, (r['height'] - low) / (high - low)))
                excess = r['reach'] - ref
                r['limit'] = (ref, t * t * (3 - 2 * t))
                if excess > 0:
                    r['target'] = r['target'] - forward * excess * r['limit'][1]
        for j, r in enumerate(rows):
            shoulder, elbow, wrist = r['shoulder'], r['elbow'], r['wrist']
            l1, l2 = (elbow - shoulder).length, (wrist - elbow).length
            delta = r['target'] - shoulder
            distance = max(.0001, min(delta.length, (l1 + l2) * .999))
            axis = delta.normalized()
            target = shoulder + axis * distance
            pole = bends[j] - axis * bends[j].dot(axis)
            pole = pole.normalized() if pole.length > 1e-5 else axis.cross(up).normalized()
            along = (l1*l1 - l2*l2 + distance*distance) / (2*distance)
            new_elbow = shoulder + axis*along + pole*math.sqrt(max(0, l1*l1 - along*along))
            r.update(l1=l1, l2=l2, target=target, upper=(new_elbow - shoulder).normalized())
        # The upper arm may only turn so fast: smooth where it points over time.
        # The hand then stays within forearm reach of the elbow, so it can fall a
        # little short of where the solve wanted it in the fastest frames.
        uppers = _smooth_directions([r['upper'] for r in rows], shoulder_smooth)
        for j, r in enumerate(rows):
            shoulder, elbow, wrist = r['shoulder'], r['elbow'], r['wrist']
            new_elbow = shoulder + uppers[j] * r['l1']
            if shoulder_smooth > 0:
                aim = r['target'] - new_elbow
                wrist_to = new_elbow + aim.normalized() * r['l2']
            else:
                wrist_to = r['target']
            if 'limit' in r:
                # Smoothing can lag the hand past the limit; hold it there.
                ref, weight = r['limit']
                excess = (wrist_to - shoulder).dot(r['forward']) - ref
                if excess > 0:
                    # Swing the forearm back so the wrist sits at the limit.
                    fwd = r['forward']
                    want = (ref - (new_elbow - shoulder).dot(fwd)) / r['l2']
                    c = (1 - weight) * (wrist_to - new_elbow).normalized().dot(fwd) + weight * max(-1, min(1, want))
                    d = (wrist_to - new_elbow).normalized()
                    side = d - fwd * d.dot(fwd)
                    side = side.normalized() if side.length > 1e-5 else fwd.cross(up).normalized()
                    wrist_to = new_elbow + (fwd * c + side * math.sqrt(max(0, 1 - c * c))) * r['l2']
            qa = (elbow - shoulder).rotation_difference(new_elbow - shoulder) @ r['qarm']
            qb = (wrist - elbow).rotation_difference(wrist_to - new_elbow) @ r['qfore']
            parent = r['qparent']
            for bone, desired in zip(r['bones'], (qa, qb, r['qhand'])):
                rest = bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
                samples.setdefault(start + j, {})[bone.name] = (
                    rest.to_quaternion().inverted() @ parent.inverted() @ desired)
                parent = desired
    # Freeze the arm over each hold, at its pose in the hold's first frame.
    for hold in holds or []:
        first_scene, last_scene = hold[:2]
        source_scene = hold[2] if len(hold) > 2 else first_scene
        blend = hold[3] if len(hold) > 3 else hold_blend
        offset = strip.action_frame_start - strip.frame_start
        a, z, src = int(first_scene + offset), int(last_scene + offset), int(source_scene + offset)
        for b in bones:
            if hold_sides is not None and not any(b.startswith('mixamorig:' + side) for side in hold_sides):
                continue
            held = samples[src][b].copy()
            for k in range(1, blend + 1):
                if z + k <= end:
                    samples[z + k][b] = held.slerp(samples[z + k][b], k / (blend + 1))
            for f in range(max(a, start), min(z, end) + 1):
                samples[f][b] = held.copy()
    for b in bones:
        previous = None
        for j, f in enumerate(range(start, end + 1)):
            q = samples[f][b]
            if previous is not None:
                q.make_compatible(previous)
            previous = q.copy()
            for axis, curve in enumerate(keys[b]):
                _set_key(curve.keyframe_points[j], q[axis])
        for curve in keys[b]:
            curve.update()
    scene.frame_set(frame)
    print('Applied', character, clip, 'forward_scale', forward_scale, 'pole_smooth', pole_smooth)
