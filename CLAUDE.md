# Wizard Foretold: notes for Claude

Two people work on this repository, each with Claude Code: Carlos (branch
`carlos`) and Rufus (branch `Rufus`). Both merge into `master`.

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
