# Wizard Foretold: notes for Claude

Two people work on this repository, each with Claude Code: Carlos and Rufus.

## Repository and branches

- **One repo only: github.com/Rufussed/Foretold** (`origin`). Carlos has push
  access. The old `cadenegr/wizard-game-platform` repo is retired: don't pull
  from it or push to it.
- **`Master` deploys.** Every push to `Master` goes live automatically through
  GitHub Actions, so only push there what is ready to play.
- **`Rufus`** is Rufus's working branch; Carlos works on his own branch. Each
  merges into `Master` when ready.
- **`foretold`** is the older Foretold-mode line (Seer and Trickster, elements,
  card art); its history has diverged from `Master`.

```bash
git clone https://github.com/Rufussed/Foretold.git
```

## Game modes are kept apart

- **Classic is the baseline.** Shared code (`src/visualizer/`, `src/pages/`,
  `backend/src/game/wizard/services/`, ...) is the Classic game. No mode
  changes how Classic behaves.
- **Each mode has its own folders**, and every file in them says at the top
  which mode it is for ("Roles mode only.", "Sabotage only."):
  - Sabotage (Rufus): `src/modes/sabotage/`, `backend/src/game/wizard/modes/sabotage/`,
    described in `game-modes/sabotage-mode.md`
  - Roles (Carlos): `src/modes/roles/`, `backend/src/game/wizard/modes/roles/`
- **Shared files only get short hooks**, gated by the mode and commented with
  the mode file they call.
- **A mode never changes another mode's behaviour**, including when it
  reuses one of its pieces.

## Notes between us

- `game-modes/note-for-rufus-2026-10-31.md`: from Carlos to Rufus. Rufus's Claude:
  please read it and tell Rufus what it says.
