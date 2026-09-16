"""Bake a height-faded two-bone arm correction. Defaults match the goatman fix."""
import bpy
import datetime
import math
from pathlib import Path
from mathutils import Vector

def run(character='goatman', thigh_fraction=.7, wrist_clearance=.12,
        fade_start=.18, fade_end=.36):
    """Distances are scene units before the seat's 3x scale. Never stacks corrections."""
    source = Path(bpy.data.filepath)
    if source.name != 'characters.blend':
        raise RuntimeError('Open characters.blend first.')
    assert fade_end > fade_start and 0 <= thigh_fraction <= 1
    rig = bpy.data.objects[character + '-rig']
    strips = [t.strips[0] for t in rig.animation_data.nla_tracks]
    assert len(strips) == 6
    if any(s.action.get('hand_rest_correction') for s in strips):
        raise RuntimeError('Already corrected. Restore uncorrected actions from the pre-hand backup before retuning.')
    backup = source.with_name('characters.before-' + character + '-hands-' +
                              datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(backup), copy=True)
    scene = bpy.context.scene
    frame = scene.frame_current
    world = rig.matrix_world.copy()
    scales = world.to_scale()
    assert max(scales) - min(scales) < 1e-5, 'Requires uniform rig scale'
    unit = 1 / scales.x
    up = (world.inverted().to_3x3() @ Vector((0, 0, 1))).normalized()
    records = []
    try:
        for strip in strips:
            action = strip.action
            start, end = map(int, action.frame_range)
            samples = []
            for f in range(start, end + 1):
                scene.frame_set(int(strip.frame_start + f - strip.action_frame_start))
                changes = {}
                for side in ('Left', 'Right'):
                    arm, forearm, hand, thigh = [rig.pose.bones['mixamorig:' + side + part]
                                                for part in ('Arm', 'ForeArm', 'Hand', 'UpLeg')]
                    shoulder, elbow, wrist = arm.head.copy(), forearm.head.copy(), hand.head.copy()
                    height = (world @ wrist).z - (world @ thigh.head).z
                    t = max(0, min(1, (height - fade_start) / (fade_end - fade_start)))
                    weight = 1 - t*t*(3 - 2*t)
                    target = thigh.head.lerp(thigh.tail, thigh_fraction) + up * (wrist_clearance * unit)
                    target = wrist.lerp(target, weight)
                    l1, l2 = (elbow - shoulder).length, (wrist - elbow).length
                    delta = target - shoulder
                    distance = max(.0001, min(delta.length, (l1 + l2) * .999))
                    axis = delta.normalized()
                    target = shoulder + axis * distance
                    pole = elbow - shoulder - axis * (elbow - shoulder).dot(axis)
                    if pole.length < .00001:
                        pole = axis.cross(up)
                    pole.normalize()
                    along = (l1*l1 - l2*l2 + distance*distance) / (2*distance)
                    new_elbow = shoulder + axis*along + pole*math.sqrt(max(0, l1*l1-along*along))
                    qa = (elbow-shoulder).rotation_difference(new_elbow-shoulder) @ arm.matrix.to_quaternion()
                    qb = (wrist-elbow).rotation_difference(target-new_elbow) @ forearm.matrix.to_quaternion()
                    parent = arm.parent.matrix.to_quaternion()
                    for bone, desired in ((arm, qa), (forearm, qb), (hand, hand.matrix.to_quaternion())):
                        rest = bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local
                        changes[bone.name] = rest.to_quaternion().inverted() @ parent.inverted() @ desired
                        parent = desired
                samples.append(changes)
            bag = action.layers[0].strips[0].channelbag(strip.action_slot)
            # Validate all expected curves before changing any clip.
            for name in samples[0]:
                path = rig.pose.bones[name].path_from_id('rotation_quaternion')
                curves = sorted([c for c in bag.fcurves if c.data_path == path], key=lambda c:c.array_index)
                assert len(curves) == 4
                assert all(len(c.keyframe_points) == len(samples) for c in curves)
                assert all(abs(k.co.x-(start+j)) < .01 for c in curves for j,k in enumerate(c.keyframe_points))
            records.append((action, bag, samples))
        for action, bag, samples in records:
            for name in samples[0]:
                path = rig.pose.bones[name].path_from_id('rotation_quaternion')
                curves = sorted([c for c in bag.fcurves if c.data_path == path], key=lambda c:c.array_index)
                previous = None
                for j, sample in enumerate(samples):
                    q = sample[name]
                    if previous is not None:
                        q.make_compatible(previous)
                    previous = q.copy()
                    for axis, curve in enumerate(curves):
                        key = curve.keyframe_points[j]
                        delta = q[axis] - key.co.y
                        key.co.y += delta
                        key.handle_left.y += delta
                        key.handle_right.y += delta
                for curve in curves:
                    curve.update()
        action['hand_rest_correction'] = 'Two-bone knee-top solve; height fade; wrist orientation preserved'
        scene.frame_set(frame)
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
    finally:
        scene.frame_set(frame)
    print('Saved', character, 'hand correction. Backup:', backup)

if __name__ == '__main__':
    run()
