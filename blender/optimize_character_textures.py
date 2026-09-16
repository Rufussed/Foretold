"""Downsize and WebP-compress material textures in characters.blend.

Run inside Blender's Python Console:
    import optimize_character_textures as opt
    opt.run(max_size=1024, quality=82)

The script edits image datablocks in place, so all material node links remain
intact. It only processes images used by material image-texture nodes, packs the
converted result into the .blend, and writes a timestamped backup first.
"""
import bpy
import datetime
import json
import os
import tempfile
import io
from pathlib import Path
from PIL import Image


def _used_images():
    result = []
    for material in bpy.data.materials:
        if material.users == 0 or not material.use_nodes:
            continue
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and node.image not in result:
                result.append(node.image)
    return result


def _is_data_texture(image):
    """Normal/roughness/specular maps benefit from preserving non-colour data."""
    needle = (image.name + ' ' + image.filepath).lower()
    return any(word in needle for word in ('normal', 'rough', 'gloss', 'specular', 'metallic', 'orm'))


def run(max_size=1024, quality=82, backup=True, normal_quality=90):
    source = Path(bpy.data.filepath)
    if source.name != 'characters.blend':
        raise RuntimeError('Open characters.blend before optimizing textures.')
    if not 256 <= max_size <= 8192:
        raise ValueError('max_size must be between 256 and 8192.')
    if not 1 <= quality <= 100 or not 1 <= normal_quality <= 100:
        raise ValueError('quality must be between 1 and 100.')

    used = _used_images()
    if backup:
        backup_path = source.with_name(
            'characters.before-texture-optimization-' +
            datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.blend')
        bpy.ops.wm.save_as_mainfile(filepath=str(backup_path), copy=True)
    else:
        backup_path = None

    report = []
    with tempfile.TemporaryDirectory(prefix='character-textures-') as temp_dir:
        for image in used:
            if image.source not in {'FILE', 'GENERATED'}:
                report.append({'image': image.name, 'status': 'skipped', 'reason': image.source})
                continue
            # Read encoded source pixels directly: no scene exposure, tone mapping,
            # or accidental gamma conversion on normal/roughness maps.
            data_texture = image.colorspace_settings.name == 'Non-Color' or _is_data_texture(image)
            is_normal = 'normal' in (image.name + ' ' + image.filepath).lower()
            # Imported images can have generic names; inspect their shader destination.
            for mat in bpy.data.materials:
                if mat.use_nodes:
                    for node in mat.node_tree.nodes:
                        if node.type == 'TEX_IMAGE' and node.image == image:
                            is_normal |= any(link.to_node.type == 'NORMAL_MAP'
                                             for out in node.outputs for link in out.links)
            settings = [max_size, quality, normal_quality if is_normal else 0]
            previous = list(image.get('web_texture_settings', []))
            if (previous == settings or (previous == [max_size, quality] and not is_normal)) and max(image.size) <= max_size:
                report.append({'image': image.name, 'status': 'already optimized'})
                continue
            if image.packed_file and not image.is_dirty:
                encoded = bytes(image.packed_file.data)
            else:
                raw_path = os.path.join(temp_dir, 'source.png')
                old_format = image.file_format
                image.file_format = 'PNG'
                image.save(filepath=raw_path, save_copy=True)
                image.file_format = old_format
                encoded = Path(raw_path).read_bytes()
            pixels = Image.open(io.BytesIO(encoded)).convert('RGBA')
            old_w, old_h = pixels.size
            if not old_w or not old_h:
                report.append({'image': image.name, 'status': 'skipped', 'reason': 'empty'})
                continue
            factor = min(1.0, float(max_size) / max(old_w, old_h))
            new_w = max(1, round(old_w * factor))
            new_h = max(1, round(old_h * factor))
            if (new_w, new_h) != (old_w, old_h):
                pixels = pixels.resize((new_w, new_h), Image.Resampling.LANCZOS)
            if pixels.getextrema()[3] == (255, 255):
                pixels = pixels.convert('RGB')
            encoded_output = io.BytesIO()
            lossless = data_texture and not is_normal
            pixels.save(encoded_output, format='WEBP', quality=normal_quality if is_normal else quality,
                        lossless=lossless, method=6, exact=True)
            payload = encoded_output.getvalue()
            image.filepath = '//optimized-textures/' + image.name.replace('/', '_') + '.webp'
            image.source = 'FILE'
            image.pack(data=payload, data_len=len(payload))
            image.reload()
            assert tuple(image.size) == (new_w, new_h), image.name
            assert image.packed_file and bytes(image.packed_file.data) == payload
            image['web_texture_settings'] = settings
            report.append({
                'image': image.name,
                'old_size': [old_w, old_h],
                'new_size': [new_w, new_h],
                'format': 'WEBP',
                'quality': quality,
                'data_texture': data_texture,
                'lossless': lossless,
                'packed_bytes': len(payload),
                'packed': bool(image.packed_file),
            })

    bpy.ops.wm.save_as_mainfile(filepath=str(source))
    output = {'file': str(source), 'max_size': max_size, 'quality': quality,
              'backup': str(backup_path) if backup_path else None, 'images': report}
    report_path = source.with_name('texture-optimization-report.json')
    report_path.write_text(json.dumps(output, indent=2))
    print(json.dumps(output, indent=2))
    return output


if __name__ == '__main__':
    run()
