"""Run inside Blender's characters.blend. Creates exportable character collections."""
import bpy, os, math, contextlib, io
from mathutils import Matrix, Vector

BASE = os.path.join(os.path.dirname(bpy.data.filepath), 'fbx')
CLIPS = [('idle','anim-sitting--side-side.fbx'), ('idleTwitchy','anim-sitting-side-side-twitchy.fbx'), ('laugh','anim-sitting-laughing.fbx'), ('disbelief','anim-sitting-disbelief.fbx'), ('disapproval','anim-sitting-disapproval.fbx'), ('thumbsUp','anim-sitting-thumbs-up.fbx')]

def import_fbx(filename, animation):
    before=set(bpy.data.objects)
    with contextlib.redirect_stdout(io.StringIO()):
        bpy.ops.import_scene.fbx(filepath=os.path.join(BASE,filename), automatic_bone_orientation=True, use_anim=animation)
    return list(set(bpy.data.objects)-before)

def prepare():
    sources=[]
    for name,filename in CLIPS:
        objects=([bpy.data.objects['_animation_source']] if name=='idle' else import_fbx(filename,True))
        rig=next(o for o in objects if o.type=='ARMATURE')
        rig.name='_source_'+name
        sources.append((name,rig,objects))
    bpy.app.driver_namespace['character_sources']=sources
    print('Prepared six animation sources')

def build(slug):
    existing=bpy.data.objects.get(slug+'-rig')
    objects=([existing]+list(existing.children_recursive) if existing else import_fbx('char-'+slug+'.fbx',False))
    rig=next(o for o in objects if o.type=='ARMATURE')
    rig.name=slug+'-rig'
    rig.animation_data_clear()
    col=bpy.data.collections.get(slug) or bpy.data.collections.new(slug)
    if col.name not in bpy.context.scene.collection.children:bpy.context.scene.collection.children.link(col)
    for o in objects:
        for c in list(o.users_collection):c.objects.unlink(o)
        col.objects.link(o)
    root=bpy.data.objects.get(slug) or bpy.data.objects.new(slug,None)
    if root.name not in col.objects:col.objects.link(root)
    root.empty_display_type='PLAIN_AXES';root.empty_display_size=.25
    root['character_id']=slug
    for o in objects:
        if o.parent not in objects:
            mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw
    rig.location=(0,0,0)
    bones=list(rig.pose.bones)
    rest={b.name:b.bone.matrix_local.copy() for b in bones}
    local={b.name:(rest[b.parent.name].inverted() @ rest[b.name] if b.parent else rest[b.name]) for b in bones}
    tracks=[]
    for name,src,_ in bpy.app.driver_namespace['character_sources']:
        matched=[b for b in bones if b.name in src.pose.bones]
        start,end=map(int,src.animation_data.action.frame_range)
        # Sample source first: target NLA never participates in the retarget.
        samples=[]
        for frame in range(start,end+1):
            bpy.context.scene.frame_set(frame)
            samples.append({b.name:(src.pose.bones[b.name].matrix.to_quaternion().copy(),src.pose.bones[b.name].head.copy()) for b in matched})
        rig.animation_data_create();rig.animation_data.action=None
        action=bpy.data.actions.new(slug+'__'+name);action.use_fake_user=True
        rig.animation_data.action=action
        ratio=rest['mixamorig:Hips'].translation.length/src.data.bones['mixamorig:Hips'].head_local.length
        previous={}
        for frame,sample in enumerate(samples,1):
            poses={}
            for b in bones:
                parent=poses[b.parent.name] if b.parent else Matrix.Identity(4)
                q=(sample[b.name][0] @ src.data.bones[b.name].matrix_local.to_quaternion().inverted() @ rest[b.name].to_quaternion()) if b.name in sample else (parent @ local[b.name]).to_quaternion()
                pos=parent @ local[b.name].translation
                if b.name=='mixamorig:Hips':
                    pos=rest[b.name].translation+(sample[b.name][1]-src.data.bones[b.name].head_local)*ratio
                desired=q.to_matrix().to_4x4();desired.translation=pos
                basis=local[b.name].inverted() @ parent.inverted() @ desired
                rot=basis.to_quaternion()
                if b.name in previous:rot.make_compatible(previous[b.name])
                previous[b.name]=rot.copy()
                b.rotation_mode='QUATERNION';b.rotation_quaternion=rot;b.location=basis.translation;b.scale=(1,1,1)
                b.keyframe_insert('rotation_quaternion',frame=frame,group=b.name)
                if b.name=='mixamorig:Hips':b.keyframe_insert('location',frame=frame,group=b.name)
                poses[b.name]=desired
        action['clip_name']=name;action['loop']=name.startswith('idle')
        tracks.append((name,action,rig.animation_data.action_slot))
    rig.animation_data.action=None
    cursor=1
    for name,action,slot in tracks:
        track=rig.animation_data.nla_tracks.new();track.name=name
        strip=track.strips.new(name,cursor,action)
        if hasattr(strip,'action_slot'):strip.action_slot=slot
        strip.extrapolation='NOTHING';strip.blend_type='REPLACE'
        cursor+=int(action.frame_range[1])+15
    root['export_note']='Export this collection only; Animation mode NLA Tracks; six tracks have common semantic names.'
    bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=max(bpy.context.scene.frame_end,cursor)
    bpy.context.scene.frame_set(1)
    print(slug+': baked six clips; '+str(len(bones))+' bones')

def finish():
    for _,_,objects in bpy.app.driver_namespace.pop('character_sources'):
        bpy.data.batch_remove(ids=objects)
    for image in bpy.data.images:
        if image.source=='FILE' and image.has_data:image.pack()
    for col in bpy.context.scene.collection.children:
        if col.name!='forest-elf':col.hide_viewport=True;col.hide_render=True
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print('Saved character library with forest-elf visible')
