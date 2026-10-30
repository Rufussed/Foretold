# Sabotage mode

Rufus's game from the `foretold` branch (last commit `ead55ae`), played as a
room mode: Create Room → Sabotage. Classic and Roles are unchanged; every rule
and look below applies only in a Sabotage game. Nothing from the branch is
merged; its pieces were copied into the folders below.

## Rules

- Ranks 8, 9 and 10 of every suit are the **Thief**, the **Trickster** and the
  **Seer**. They follow suit and rank by number like any other card; the deck
  stays 60 cards.
- Win a trick with the **Seer**: you may move your own prediction by one, up or
  down (kept between 0 and the cards dealt). The **Trickster** does the same to
  an opponent's prediction.
- Win a trick with the **Thief**: pick a player, then one of your cards and one
  of theirs (unseen), and swap them. Nothing happens on a round's last trick.
- Winning with a Wizard or a higher card does nothing. A human who runs out of
  time leaves the power unused.
- Scoring is Classic: 20 + 10 per trick, -10 per trick off.
- Suits are shown as elements: Red = Fire, Green = Earth, Blue = Water,
  Yellow = Air. The server still knows them by colour.

The Thief here is Sabotage's card, not the Roles mode's Thief role. Its code is
named apart: `sabotageThief.ts`, `sabotage_thief_*` messages,
`sabotage-thief-*` files, `sabotage.*` texts.

## Where it lives

| What | Where |
|---|---|
| Rules: card values, `SabotagePower` on the trick, phase `"power"` | `backend/src/game/wizard/modes/sabotage/cardPowers.ts`, `sabotageThief.ts` |
| The runner's power step, socket messages, dev shortcuts | `powerDecision.ts`, `sabotageMessages.ts`, `devTools.ts` (same folder) |
| Bots (Apprentice simple rules, Adept expected-score reasoning) | `modes/sabotage/bots/` |
| Tests | `modes/sabotage/cardPowers.test.ts` |
| Deck: art, numbers, titles, icons and symbols printed in code, wear, back | `src/modes/sabotage/deck/`, art in `src/assets/sabotage-cards/` |
| Look settings (cards, raised and played card sizes, Thief motion, sparks) | `src/modes/sabotage/sabotage-config.ts` |
| Which game is on the table | `src/modes/sabotage/sabotage-game.ts` (`isSabotageGame()`) |
| Prompts: Seer/Trickster, Thief | `src/modes/sabotage/prompts/` |
| Thief heist in 3D, director checks | `src/modes/sabotage/heist/` |
| Announcements, prediction reveal | `src/modes/sabotage/hud/` |
| Trump chooser icons and colours | `src/modes/sabotage/sabotage-trump.ts` |
| Styles (scoped under `.is-sabotage`) | `src/modes/sabotage/sabotage.css` |
| Dev tools (Shift+1..4 suit viewer; Thief keys with `WIZARD_DEV_TOOLS`) | `src/modes/sabotage/dev/` |

Shared files only call into these, behind `mode === "sabotage"` or
`isSabotageGame()`: `wizardGameService`, `wizardGameRunner`, `wizardSocket`,
`bots/adept.ts`, `pages/Visualizer.ts`, `card-texture-loader`, `card-textures`,
`card-table`, `table-cards`, `opponent-hands`, `table-director`, `table-layout`,
`torch-sparks`, `portrait-camera`, `trump-prompt`, `hud/announcements`,
`hud/announcer`, `hud/game-hud`, `hud/player-list`, `hud/round-stats`.

Rufus's table tweaks apply to Sabotage tables only: your hand 0.2 m closer,
cards in play larger when few, a raised card 1.5 times bigger, the iPad blind
tour in portrait only, sparks born up the flame. His forest horizon is not
used. The text game page (`pages/WizardGame.ts`) passes on a power by itself.

## Open

- A Sabotage rules page and help window, like the Roles one.
- Profile stats do not tell the modes apart.
