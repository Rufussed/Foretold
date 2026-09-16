# Character library reference

Read `CHARACTER_WORKFLOW.md` before editing/exporting character animations.
The current `characters.blend` already includes hip alignment, witch cloak
correction, knee-top resting-hand corrections on all six characters, and GLB-compatible material fixes.
Do not rebuild it with `build_character_library.py`: that was a session-specific
bootstrap helper and is not a safe rebuild pipeline for the corrected library.

Reusable tools: `export_characters.py`, `adjust_resting_hands.py`, and
`optimize_character_textures.py`. Texture optimization defaults to a 1024px cap,
WebP quality 82 for colour and 90 for normals, lossless for other data maps.
It backs up the blend, preserves image links and colour spaces, and packs images.
Run inside Blender, not system Python. Never rerun hand correction on already
corrected clips; the script checks the action metadata and refuses to stack it.
Exporting replaces six `public/models/wizard/char-*.glb` files, backs up old files,
and leaves `Wizard.glb` untouched. Preserve current Blender UI state.
