# Foretold mode (planned)

A second way to play, built from Rufus's `foretold` branch. **Not built yet.**
This file says what the mode is, where Rufus's working version lives, and how
to add it to `carlos` without changing classic play.

## Ground rule

**Classic play is the baseline and must not change.** Every new rule below
applies only when a room chooses the Foretold mode. A room that doesn't, an
older room, and a saved game with no mode recorded all play classic, exactly as
today. Nothing in this file may be switched on globally.

## Source

- Branch `origin/foretold`, 15 commits after `master`'s `2459181`, newest
  `5425451` (2026-10-20). Check `git log carlos..origin/foretold` before
  starting, in case Rufus has added more.
- Rufus's own write-up: `NOTES-for-backend.md` on that branch, section
  "Seer and Trickster powers, scoring and elements".
- Card titles and powers: `source-images/card-hierarchy.md` on that branch.
- Do **not** merge the branch. It also renames the product to "Foretold",
  replaces the card loader, moves the hand, makes trick cards grow, and
  deletes the classic card scans. Take only the pieces listed below.

## The rules of the mode

### Seer and Trickster (the card powers)

- Rank 7 of every suit is the **Trickster**, rank 8 the **Seer**. They stay
  ordinary cards: they follow suit and rank by number. The deck stays 60
  cards, so rounds per player count are unchanged (20/15/12/10).
- **Win a trick with one and you may change a prediction by one:** the Seer
  your own, the Trickster one opponent's. The new number is the old one -1, the
  same, or +1, kept between 0 and the round number (the cards dealt). Choosing
  the same number means no change.
- No limit per round; it also works on the last trick (the score is worked
  out after it). If a Wizard or a higher card wins the trick, nothing happens.
- A human who runs out of time leaves it unused.

### Scoring divided by ten

- Exact prediction: **2 + 1 per trick won** (classic: 20 + 10 per trick).
- Miss: **-1 per trick of difference** (classic: -10).
- Profile levels on Rufus's branch use 20 instead of 200 points per full game.
  Mixing the two scales in one profile needs a decision (see Open questions).

### Elements

- Suits are shown as **Fire, Earth, Water, Air** (Feuer, Erde, Wasser, Luft)
  instead of colours. Display only: the backend and database keep
  `Red`/`Green`/`Blue`/`Yellow`.
- Mapping: Red = Fire, Green = Earth, Blue = Water, Yellow = Air.

## Where it is on Rufus's branch

### Backend

| What | Files |
|---|---|
| `TRICKSTER_VALUE` 7, `SEER_VALUE` 8, `CardPower`, `powerOf(card)` | `models/card.ts` |
| `TrickPower` `{ kind, username, resolved, target, from, to }` on `TrickState.power`; new phase `"power"` | `models/wizardGame.ts` |
| `hasPendingPower`, `beginPower`, `usePower`, `skipPower`; `resolveTrick` sets `power`; `advanceAfterTrick` waits for it | `services/wizardGameService.ts` |
| After a trick: phase `"power"`, wait for the winner, bots decide after `botTrumpDelayMs`, timeout skips, hold `afterPowerHoldMs` (2000) | `services/wizardGameRunner.ts`, `wizardTiming.ts` |
| Socket messages `{ type: "use_power", target?, prediction }` and `{ type: "skip_power" }` | `websocket/wizardSocket.ts` |
| Scoring numbers `EXACT_PREDICTION_BONUS` 2, `POINTS_PER_TRICK` 1, `MISS_PENALTY_PER_TRICK` 1 | `scoringRules.ts` (new), `services/wizardScoreCalculator.ts` |
| Global switch `cardPowersEnabled` | `gameplayRulesConfig.ts` |
| Bots: `BotStrategy.choosePower`; Apprentice only mends its own bid with a Seer (`bots/powers.ts`); Adept reasons about expected score (`bots/powerReasoning.ts`, `bots/handStrength.ts`, `bots/adept.ts`) | `bots/` |
| Tests (rules, range, who may use it, scoring, bots) | `services/cardPowers.test.ts`, `services/wizardScoreCalculator.test.ts` |

Rufus measured the Adept's power reasoning in 180 three-player games: 51% wins
against Adepts with the simple rule (33% would be even).

### Frontend (the 3D game)

| What | Files |
|---|---|
| The power prompt: pick -1 / same / +1, and an opponent for the Trickster | `src/visualizer/power-prompt.ts` (new) |
| Announcing a power, a changed prediction that swells and flashes in the player list | `hud/announcements.ts`, `hud/announcer.ts`, `hud/game-hud.ts`, `hud/player-list.ts`, `hud/round-stats.ts` |
| Trump chooser with element icons and colours | `trump-prompt.ts` |
| Text: power prompts, element names, rank titles, rules text | `src/i18n/en.ts`, `de.ts`, `long-texts.ts` |
| The old text game page has **no** power prompt; with "No limit" turns a game would wait forever there | `src/pages/WizardGame.ts` |

## How to add it to carlos

1. **A mode option.** Add `mode: "classic" | "foretold"` to
   `WizardGameOptions` in `backend/src/game/wizard/gameOptions.ts`, `"classic"`
   in both `DEFAULT_GAME_OPTIONS` and `LEGACY_GAME_OPTIONS`, and accept it in
   `normalizeGameOptions` (anything unknown becomes `"classic"`). Rooms already
   store options in `rooms.options_json`, so no migration is needed. Offer it in
   the room setup (`src/pages/Room.ts`) next to the other options.
2. **Replace the global switches with the mode.** Where Rufus checks
   `GAMEPLAY_RULES.cardPowersEnabled`, check `game.options.mode ===
   "foretold"` instead. Scoring takes the game (or its mode) and picks classic
   (20/10/10) or Foretold (2/1/1) numbers; keep both sets in `scoringRules.ts`.
3. **Port the backend pieces** from the table above, each behind the mode.
   Bring `cardPowers.test.ts` along and add tests that a classic game never
   enters the `"power"` phase and scores 20/10/10.
4. **Port the frontend pieces** so they only appear in a Foretold game: the
   power prompt, the power announcements, element names and the trump chooser
   look. Classic games keep colour names.
5. **The text game page** (`WizardGame.ts`): give it a simple power prompt, or
   skip the power there automatically, so it can't hang.
6. **Cards:** a Foretold game can use a deck whose 7 and 8 show the Seer and
   Trickster (see `card-art/elements-deck/README.md`); classic keeps plain
   cards.
7. Checks: backend `npm run typecheck`, `npx vitest run`; frontend
   `npx tsc --noEmit`, `npx vite build`. Then play one classic and one
   Foretold game with NPCs, including a Seer or Trickster on the last trick.

## Open questions

- **Profile and stats:** classic and Foretold scores differ by ten times. Keep
  separate stats per mode, scale Foretold scores up when storing, or keep
  points only for classic?
- **Element names in classic:** stay colours (the plan above), or use elements
  everywhere once the card art is elemental?
- Rufus's German rank titles are a first draft.
