"""Run inside Blender's characters.blend. Adds a seated `victory` clip to each rig.

Spine and everything above it come from a standing Mixamo FBX (imported the
standard way: legacy importer, Automatic Bone Orientation). Hips and legs, plus
bones the FBX lacks (witch cloak, Neck1), hold the rig's own idle frame 1, so
existing hip/foot corrections carry over. One constant world rotation maps the
FBX spine onto the idle spine at frame 1; all later upper-body motion, including
the FBX hip twist, rides on top of it. The hips (and upper body with them) tip forward by one
constant angle so the mean torso lean hits LEAN_TARGET; legs keep their idle
world pose so they stay seated. Hanging arms are tilted ARM_SPREAD
outward so the hands clear the seat. The upper body eases out of and back
into the idle pose at the clip ends, since the FBX starts and ends standing.

    import add_victory_clip as v; v.run('demon')   # or v.run() for all six
"""
import bpy, contextlib, io, math
from mathutils import Quaternion, Vector

FBX = '/home/rlane/Downloads/Victory.fbx'
CLIP = 'victory'
CHARACTERS = ['forest-elf', 'blind-wizard', 'black-witch', 'goatman', 'demon', 'kungfu-girl']
GAP = 15  # frames between NLA strips, as in build_character_library.py
EASE_IN, EASE_OUT = 20, 30  # frames over which the upper body leaves / returns to the idle pose
LEAN_TARGET = math.radians(0)  # mean torso pitch (hips→neck from vertical) to aim for; + leans forward
ARM_SPREAD = math.radians(15)  # hanging arms tilt outward by this much, so hands clear the seat


def import_source():
    before, actions = set(bpy.data.objects), set(bpy.data.actions)
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.import_scene.fbx(filepath=FBX, automatic_bone_orientation=True, use_anim=True)
    objects = list(set(bpy.data.objects) - before)
    return next(o for o in objects if o.type == 'ARMATURE'), objects + list(set(bpy.data.actions) - actions)


def upper_body(rig):
    spine = rig.pose.bones['mixamorig:Spine']
    return {spine.name} | {b.name for b in spine.children_recursive}


def weight(frame, length):
    """0 = idle upper body, 1 = FBX upper body; smoothstep at both ends of the clip."""
    t = min(1.0, (frame - 1) / EASE_IN, (length - frame) / EASE_OUT)
    return t * t * (3 - 2 * t)


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def spread(arm, chest, down):
    """Rotation tilting a hanging upper arm away from the body; fades out as the arm rises."""
    direction = (arm.to_3x3() @ Vector((0, 1, 0))).normalized()
    out = arm.translation - chest.translation
    out = (out - out.dot(down) * down).normalized()
    amount = smoothstep((direction.dot(down) - 0.6) / 0.3)
    return Quaternion(direction.cross(out).normalized(), ARM_SPREAD * amount)


def torso_pitch(rig, clip, rotation, local, frames):
    """Correction rotation that brings the mean hips→neck lean over `frames` to LEAN_TARGET."""
    inv = rig.matrix_world.inverted().to_3x3()
    up, forward = (inv @ Vector((0, 0, 1))).normalized(), (inv @ Vector((0, -1, 0))).normalized()
    chain = ['mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck']
    leans = []
    for frame in frames:
        pose = rotation('mixamorig:Spine', clip[frame])
        pose.translation = Vector()
        for parent, child in zip(chain, chain[1:]):
            head = (pose @ local[child]).translation
            pose = rotation(child, clip[frame])
            pose.translation = head
        leans.append(math.atan2(pose.translation.dot(forward), pose.translation.dot(up)))
    lean = sum(leans) / len(leans)
    return Quaternion(up.cross(forward).normalized(), LEAN_TARGET - lean), lean


def sample(src, rig, frames):
    """Armature-space rotations of the source per frame, and the target's idle frame 1."""
    scene = bpy.context.scene
    scene.frame_set(1)  # target NLA: idle strip starts at 1
    idle = {b.name: b.matrix.copy() for b in rig.pose.bones}
    names = [b.name for b in src.pose.bones]
    clip = []
    for frame in frames:
        scene.frame_set(frame)
        clip.append({n: src.pose.bones[n].matrix.to_quaternion() for n in names})
    return idle, clip


def build(slug, src):
    rig = bpy.data.objects[slug + '-rig']
    ad = rig.animation_data
    old = bpy.data.actions.get(slug + '__' + CLIP)
    if CLIP in ad.nla_tracks:
        ad.nla_tracks.remove(ad.nla_tracks[CLIP])
    if old:
        bpy.data.actions.remove(old)

    start, end = map(int, src.animation_data.action.frame_range)
    idle, clip = sample(src, rig, range(start, end + 1))
    bones = list(rig.pose.bones)
    rest = {b.name: b.bone.matrix_local.copy() for b in bones}
    local = {b.name: (rest[b.parent.name].inverted() @ rest[b.name] if b.parent else rest[b.name]) for b in bones}
    upper = upper_body(rig) & set(clip[0])
    passengers = upper_body(rig) - upper
    to_target = {n: src.data.bones[n].matrix_local.to_quaternion().inverted() @ rest[n].to_quaternion() for n in upper}
    spine = 'mixamorig:Spine'
    idle_basis = {b.name: ((local[b.name].inverted() @ idle[b.parent.name].inverted() if b.parent else rest[b.name].inverted())
                           @ idle[b.name]).to_quaternion() for b in bones}
    arm_chains = {side: {'mixamorig:%sArm' % side} | {c.name for c in rig.pose.bones['mixamorig:%sArm' % side].children_recursive}
                  for side in ('Left', 'Right')}
    down = (rig.matrix_world.inverted().to_3x3() @ Vector((0, 0, -1))).normalized()
    align = idle[spine].to_quaternion() @ (clip[0][spine] @ to_target[spine]).inverted()
    victory = lambda n, q: (align @ q[n] @ to_target[n]).to_matrix().to_4x4()
    full = [i for i in range(len(clip)) if weight(i + 1, len(clip)) == 1]
    pitch, lean = torso_pitch(rig, clip, victory, local, full)

    action = bpy.data.actions.new(slug + '__' + CLIP)
    action.use_fake_user = True
    action['clip_name'] = CLIP
    action['loop'] = False
    saved = ad.action
    ad.action = action
    previous = {}
    for frame, sample_q in enumerate(clip, 1):
        poses, tilt = {}, {}
        tip = Quaternion().slerp(pitch, weight(frame, len(clip)))  # hips tip forward; legs stay on idle
        for b in bones:
            parent = poses[b.parent.name] if b.parent else None
            if b.name in upper:
                desired = (tip.to_matrix() @ victory(b.name, sample_q).to_3x3()).to_4x4()
                desired.translation = (parent @ local[b.name]).translation
                side = next((k for k, chain in arm_chains.items() if b.name in chain), None)
                if side:  # whole arm chain swings about the shoulder joint
                    if side not in tilt:
                        tilt[side] = spread(desired, poses['mixamorig:Spine2'], down)
                    desired = (tilt[side] @ desired.to_quaternion()).to_matrix().to_4x4()
                    desired.translation = (parent @ local[b.name]).translation
            elif b.name in passengers:
                # Upper-body bone the FBX lacks: keep its idle pose relative to its parent.
                desired = parent @ (idle[b.parent.name].inverted() @ idle[b.name])
            elif b.name == 'mixamorig:Hips':
                desired = (tip.to_matrix() @ idle[b.name].to_3x3()).to_4x4()
                desired.translation = idle[b.name].translation
            else:
                desired = idle[b.name].copy()
            basis = (local[b.name].inverted() @ parent.inverted() if parent else rest[b.name].inverted()) @ desired
            rot = basis.to_quaternion()
            if b.name in upper:  # blend local rotations, so clip ends match idle (hands on knees) exactly
                rot = idle_basis[b.name].slerp(rot, weight(frame, len(clip)))
                blended = rot.to_matrix().to_4x4()
                blended.translation = basis.translation
                desired = parent @ local[b.name] @ blended
            if b.name in previous:
                rot.make_compatible(previous[b.name])
            previous[b.name] = rot.copy()
            b.rotation_mode = 'QUATERNION'
            b.rotation_quaternion = rot
            b.location = basis.translation
            b.scale = (1, 1, 1)
            b.keyframe_insert('rotation_quaternion', frame=frame, group=b.name)
            if b.name == 'mixamorig:Hips':
                b.keyframe_insert('location', frame=frame, group=b.name)
            poses[b.name] = desired
    slot = ad.action_slot
    ad.action = saved
    for b in bones:  # clear the scratch pose so NLA drives the rig again
        b.rotation_quaternion = (1, 0, 0, 0); b.location = (0, 0, 0)

    cursor = max(int(s.frame_end) for t in ad.nla_tracks for s in t.strips) + GAP
    track = ad.nla_tracks.new()
    track.name = CLIP
    strip = track.strips.new(CLIP, cursor, action)
    strip.action_slot = slot
    strip.extrapolation = 'NOTHING'
    strip.blend_type = 'REPLACE'
    scene = bpy.context.scene
    scene.frame_end = max(scene.frame_end, int(strip.frame_end))
    print(f'{slug}: victory baked, {len(clip)} frames at {cursor}; torso lean {math.degrees(lean):+.1f}° corrected to {math.degrees(LEAN_TARGET):+.1f}°')


def run(*characters):
    scene = bpy.context.scene
    frame = scene.frame_current
    src, imported = import_source()
    try:
        for slug in characters or CHARACTERS:
            build(slug, src)
    finally:
        bpy.data.batch_remove(ids=imported)  # imported objects and their actions
        scene.frame_set(frame)
