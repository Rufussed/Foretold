# Note for Rufus (and your Claude), 2026-10-31

From Carlos.

## Your Sabotage visuals work

Sabotage plays well on `master`: your deck, the elements, the Seer and
Trickster prompts, the 3D Thief heist and the prediction flashes. Nothing in
today's Roles work changes how Sabotage looks or plays.

One piece is shared: the player list's held-back prediction
(`src/modes/sabotage/hud/prediction-reveal.ts`), which waits for the
"prediction changed" banner before showing the new number. Roles now uses it
too, for the Prophet lowering her bid. In Roles the number only flashes; your
tesseract and burst effects are skipped there (`onPredictionEffect` in
`src/pages/Visualizer.ts`). If you change that file, Roles depends on it
still showing a change when its banner comes up.

## Please keep each mode in its own place

That is how we work on Roles now, and Sabotage is already laid out that way:

- **Classic is the baseline.** The shared code (`src/visualizer/`,
  `backend/src/game/wizard/services/`, ...) is the Classic game. A mode does
  not change how Classic behaves.
- **A mode's code lives in its own folders:**
  - Sabotage: `src/modes/sabotage/`, `backend/src/game/wizard/modes/sabotage/`
  - Roles: `src/modes/roles/`, `backend/src/game/wizard/modes/roles/`
- **Each file there says so at the top**, e.g. "Roles mode only." or
  "Sabotage only.", and says what it is for.
- **Shared files only get a short hook** with a comment pointing to the mode's
  file, for example `announcements.ts` calling `roleMessages(...)` from
  `src/modes/roles/hud/role-announcements.ts`. Any change on a shared path is
  gated by the mode, so the other modes don't notice it.
- **A mode never changes another mode.** If you reuse something from Roles,
  or Roles reuses something of yours (like the prediction reveal), keep the
  other mode working exactly as it did.

Today we moved the last Roles banner code out of
`src/visualizer/hud/announcements.ts` into `src/modes/roles/hud/`, so that
file is now Classic plus short hooks to Sabotage and Roles.

## What's new on master for Roles (so nothing surprises you)

- Roles 10 to 13: Gambler, Duke, Prophet, King. The Prophet is named apart
  from your Seer out of respect: the Seer is your idea.
- New game phase `"granting"` (the Duke's choice), next to `"fishing"`.
- `PlayedCard` has `bet?` and `lowered?`; `TrickState` has `grantedTo?`;
  `RoleAction` has `undone?` and `stopped?`. All Roles only.
- The hourglass also times Roles choices (`src/modes/roles/choice-timer.ts`),
  hooked into `src/visualizer/hourglass-turns.ts`.

The repository's `CLAUDE.md` has the same layout rules in short.
