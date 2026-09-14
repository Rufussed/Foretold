"""Run in Blender: import export_characters; export_characters.run()."""
import bpy
import datetime
import json
from pathlib import Path
import shutil
import struct

CHARACTERS = ('forest-elf', 'blind-wizard', 'black-witch', 'goatman', 'demon', 'kungfu-girl')
CLIPS = {'idle', 'idleTwitchy', 'laugh', 'disbelief', 'disapproval', 'thumbsUp'}

def run():
    source = Path(bpy.data.filepath)
    if source.name != 'characters.blend':
        raise RuntimeError('Open characters.blend before exporting.')
    output = source.parent.parent / 'public/models/wizard'
    output.mkdir(parents=True, exist_ok=True)
    backup = source.parent / 'export-backups' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup.mkdir(parents=True)
    for name in CHARACTERS:
        assert bpy.data.collections.get(name), name
        path = output / f'char-{name}.glb'
        if path.exists():
            shutil.copy2(path, backup / path.name)
    layer = bpy.context.view_layer
    scene = bpy.context.scene
    state = dict(frame=scene.frame_current, active=layer.objects.active,
                 objects=[(o, o.hide_get(), o.hide_viewport, o.hide_render, o.select_get()) for o in bpy.data.objects],
                 collections=[(c, c.hide_viewport, c.hide_render) for c in bpy.data.collections],
                 layers=[(c, c.hide_viewport, c.exclude) for c in layer.layer_collection.children])
    results = []
    try:
        for name in CHARACTERS:
            for c, _, _ in state['layers']:
                c.exclude = False
                c.hide_viewport = c.name != name
            for c, _, _ in state['collections']:
                c.hide_viewport = c.hide_render = False
            for o, *_ in state['objects']:
                o.hide_viewport = o.hide_render = False
                o.hide_set(False)
                o.select_set(False)
            for o in bpy.data.collections[name].all_objects:
                o.select_set(True)
            layer.objects.active = bpy.data.objects[name + '-rig']
            scene.frame_set(1)
            path = output / f'char-{name}.glb'
            temporary = output / f'char-{name}.exporting.glb'
            bpy.ops.export_scene.gltf(
                filepath=str(temporary), check_existing=False, collection=name,
                use_selection=True, use_visible=True, export_format='GLB',
                export_image_format='WEBP', export_image_webp_fallback=False,
                export_animations=True, export_animation_mode='NLA_TRACKS',
                export_anim_slide_to_zero=True, export_frame_range=False,
                export_extras=True, export_all_influences=True)
            with temporary.open('rb') as f:
                assert f.read(4) == b'glTF'
                f.read(8)
                length, kind = struct.unpack('<II', f.read(8))
                assert kind == 0x4E4F534A
                data = json.loads(f.read(length))
            clips = [a['name'] for a in data.get('animations', [])]
            assert len(clips) == 6 and set(clips) == CLIPS, (name, clips)
            assert len(data.get('skins', [])) == 1, name
            names = {n.get('name') for n in data['nodes']}
            assert name in names and not any(other in names for other in CHARACTERS if other != name)
            # Current library intentionally uses dielectric materials throughout.
            assert all(m.get('pbrMetallicRoughness', {}).get('metallicFactor', 1) == 0
                       for m in data.get('materials', [])), name
            temporary.replace(path)
            results.append(dict(character=name, bytes=path.stat().st_size, clips=clips))
    finally:
        for c, hidden, excluded in state['layers']:
            c.exclude = False
            c.hide_viewport = False
        for o, hidden, viewport, render, selected in state['objects']:
            o.hide_set(hidden)
            o.hide_viewport, o.hide_render = viewport, render
            o.select_set(selected)
        for c, viewport, render in state['collections']:
            c.hide_viewport, c.hide_render = viewport, render
        layer.objects.active = state['active']
        for c, hidden, excluded in state['layers']:
            c.hide_viewport, c.exclude = hidden, excluded
        scene.frame_set(state['frame'])
    report = dict(backup=str(backup), exports=results)
    (backup / 'export-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return report

if __name__ == '__main__':
    run()
