# Character library and repeatable tools

`characters.blend` is the master. Six collections: forest-elf, blind-wizard,
black-witch, goatman, demon, kungfu-girl. Each has a root empty, armature and meshes.
Roots stay at origin with scale 1; `seat2`–`seat6` in `Wizard-Scene.blend` supply
placement and 3x scale. The FBX conversion remains inside the character asset.

Each armature has six sequential NLA tracks: `idle`, `idleTwitchy`, `laugh`,
`disbelief`, `disapproval`, `thumbsUp`. Export NLA Tracks, Slide to Zero enabled,
playback-range limiting disabled, WebP textures, Custom Properties enabled.

## Run from Blender's Python Console

With `characters.blend` open:

```python
import bpy, sys, importlib
folder = bpy.path.abspath('//')
if folder not in sys.path: sys.path.insert(0, folder)
import export_characters
importlib.reload(export_characters)
export_characters.run()
```

Exports to the six existing `public/models/wizard/char-<character>.glb` paths.
Backups and a verification report go under `blender/export-backups/<timestamp>/`.
Each GLB is validated for six clip names, one skin, the intended character root,
absence of other character roots, and the current nonmetal material baseline.
Each validated temporary file replaces its destination; an error can leave earlier
characters updated, with originals still available in the backup directory.
Visibility, selection and timeline are restored. The environment GLB is untouched.
All skin influences are exported; test runtime performance/deformation in Three.js.
If intentional metal materials are introduced later, update the material check.

## Texture optimization

Run `import optimize_character_textures as opt; opt.run(max_size=1024, quality=82, normal_quality=90)`
inside Blender with characters.blend open. Requires Pillow in Blender's Python
(available on this machine). Images referenced by material texture nodes are
resized without upscaling and repacked in place. Colour spaces and alpha are
preserved. Colour images use WebP quality 82; normals use quality 90; other
non-colour data maps use lossless WebP. The same settings skip already optimized
images to avoid repeated lossy compression. Restore original packed images from
the timestamped backup if increasing resolution or changing quality substantially.
Run `export_characters.run()` afterward to update the web assets.
`texture-optimization-report.json` records the latest pass.

Goatman's original 14.83 MB GLB had 10.93 MB of embedded textures: seven 4K
images, including a 6.05 MB hair diffuse/alpha image. Geometry, animation and
metadata together accounted for about 3.90 MB. Textures were the main size cause.

## Resting hands

`adjust_resting_hands.run(character='goatman')` reproduces the arm correction:
two-bone analytic arm solve, wrist target 70% along the thigh (near the knee) and 0.12 scene units
above its bone, fully applied below 0.18 units of hand height above the hip,
smoothly fading to zero by 0.36. It preserves hand world orientation and finger
animation. It changes only upper-arm, forearm and hand quaternion keys, on all
six clips, and saves a timestamped blend backup before editing.

The original goatman correction used 28% along the thigh. The reusable script now
defaults to 70% (near the knee). These parameters require visual checking, not universally for every body shape.
Review idle and raised gestures visually; there is no collision simulation.
All six characters' current actions are ALREADY corrected and tagged
`hand_rest_correction`. The script intentionally refuses to modify them again.
To retune, restore the uncorrected goatman actions from a pre-hand backup into a
working copy, preserving subsequent material fixes and other character changes.
Do not simply delete the marker and stack another correction. Then run:

```python
import adjust_resting_hands
importlib.reload(adjust_resting_hands)
adjust_resting_hands.run(character='goatman')
```

## Changes already present (2026-09-14)

- Hip translations: one constant offset per non-idle clip, matching that rig's
  first idle frame; existing intra-clip motion retained.
- Black witch cloak: seven cloak bones biased toward gravity at each frame,
  65% at the top through 90% at the hem, baked across all six clips.
- All six characters: low hand poses corrected toward the top of the knee (100%); raised gestures retained. Goatman original arm curves were restored before retuning from the earlier 28% target.
- Black witch cloak correction retained during the hand edits.
- Materials: glossiness inverted into actual packed roughness image textures,
  connected directly to Principled BSDF for GLB compatibility. Imported metallic
  0.5 values changed to 0; specular textures disconnected and IOR level set to 0.5;
  untextured roughness has a 0.65 minimum. Base color and normals preserved.

The hip/cloak/material operations were executed through MCP; only the hand and
export procedures are saved as reusable scripts here. Do not assume other script
files exist. Blender Text Editor also contains CHARACTER LIBRARY - READ ME.

MCP occasionally reports Connection closed during a long export while Blender
continues working. Check output timestamps and Blender responsiveness before
retrying, to avoid running overlapping exports.
