# Wizard

A web version of the trick-taking card game **Wizard** (a variant of Oh Hell):
each round you predict exactly how many tricks you'll win, and you score for
being right rather than for winning the most.

The game rules, lobby and turn loop run on the backend and are largely working.
The current focus is the **3D visualiser** — a rendered table that shows the
game as it's played, rather than the HTML debug view.

## Layout

```
backend/          Fastify + SQLite + WebSocket. Rules, bots, lobby, turn loop.
src/              Vite + TypeScript frontend, hash-routed.
  pages/          Home, Lobby, Profile, WizardGame (HTML view), Visualizer
  services/       REST + game WebSocket clients
  visualizer/     three.js scene — see below
blender/          Blender sources for the 3D scene, plus a small add-on
public/models/    Exported .glb the visualiser loads (gitignored, see below)
```

## Running it

Two terminals:

```bash
cd backend && npm install && npm run dev   # API + WebSocket on :3000
npm install && npm run dev                 # frontend on :5173
```

Then open <http://localhost:5173>. The 3D view is at `#/game/<roomId>/visualizer`,
or via the **3D View** link on the game page.

## The visualiser

`src/visualizer/` is deliberately small:

- **`three-scene.ts`** — loads the environment `.glb`, plays its animations (camera
  move, torch flicker), and applies the lighting and shadow settings.
- **`player-characters.ts`** — spawns characters at the `seat2`–`seat6` nodes, each
  with its own animation mixer: a looping idle plus one-shot emotes. In dev, try
  `__wizard.players.emote(2, "laugh")` from the browser console.
- **`config.ts`** — all the tuning in one place: light intensity and falloff,
  which torches cast shadows, shadow quality, animation speed, camera controls.
  Each value notes three.js's own default so it's clear what's been changed.

Scene content — table, characters, torches, camera move — is authored in Blender
and exported to `public/models/wizard/Wizard.glb`. Nothing about the game is
hard-coded in the scene; the visualiser reads what's in the file.

### Blender pipeline

- Export as **glTF Binary (.glb)** over the path above, with **Images → WebP**
  (keeps it ~5MB rather than ~78MB) and **Custom Properties** enabled — a `loop`
  property on the camera is what stops its intro move from repeating.
- Characters are Mixamo rigs. Import every character *and* animation the same
  way (Legacy FBX importer, Automatic Bone Orientation), or shared animations
  deform subtly wrongly — all Mixamo rigs use identical bone names.
- `.glb` files are gitignored as build artefacts; the `.blend` sources are
  tracked. Re-export after changing the scene.
- `blender/addons/parent_empty.py` adds **Ctrl+Shift+P**: parents the selected
  object to an empty at its origin, for placing and scaling characters without
  touching their imported transforms.
