# Backend changes from the 3D visualiser work

Notes for whoever owns the backend. While building the three.js visualiser
(`src/visualizer/`), a few backend changes were needed. Everything below is in
the working tree; nothing about the existing game rules changed except where
marked **rule change**.

## Avatars and the waiting room

Players pick one of six avatars before a game starts, first come first served.

- `db/schema.sql`: `room_players` has a new `avatar TEXT` column.
- `db/migrations.ts` (new): migration 1 adds that column to existing databases
  if it's missing (`PRAGMA table_info` then `ALTER TABLE`), then creates the
  unique index `room_players_avatar_unique ON room_players(room_id, avatar)`.
  The index is what enforces one avatar per player in a room; SQLite treats
  NULLs as distinct, so any number of players can be unpicked. It lives here
  rather than in `schema.sql` because on an existing database the index would
  be created before the column exists.
- `models/avatar.ts` (new): `AVATAR_IDS`, `AvatarId`, `isAvatarId`. Shared with
  the frontend.
- `models/wizardGame.ts`: `Room.players` is now `RoomPlayer[]`
  (`{ username, avatar }`) instead of `string[]`; `GamePlayer` and
  `PublicGamePlayer` have `avatar: AvatarId`.
- `services/wizardLobbyManager.ts`: selects the avatar; new
  `claimAvatar(roomId, username, avatar)` returns false when the unique index
  refuses it.
- `routes/wizardRoutes.ts`:
  - `GET /wizard/lobby/:roomId`: a single room, which the waiting room polls.
  - `POST /wizard/lobby/:roomId/avatar` with `{ avatar }`: 400 unknown avatar,
    403 not in the room, 409 room not waiting or avatar taken.
  - `POST /wizard/games` passes the claimed avatars on.
- `services/wizardGameService.ts`: `assignAvatars` keeps each claim and gives
  bots, and anyone who didn't pick, a random unclaimed avatar.
  `getPublicGameState` includes `avatar`.

## Bots

- **Names** (new `botNames.ts`, `models/bot.ts`): bots are called
  `"<name> NPC"`, e.g. `Morgana NPC`, drawn at random from the editable lists
  in `botNames.ts`. Names suit the bot's avatar: male names for goatman, demon
  and blind-wizard, female names for forest-elf, black-witch and kungfu-girl
  (`AVATAR_NAME_LIST`). The ` NPC` suffix is now what marks a bot:
  `WizardBotService.isBot` uses `isBotName` instead of `startsWith("bot-")`.
  `wizardBot.test.ts` data updated to match.
- **Game start** (`routes/wizardRoutes.ts`, `POST /wizard/games`): avatars are
  assigned first, with `assignAvatars` (now exported from
  `wizardGameService.ts`) over the humans plus a placeholder per bot; each bot
  is then named for its avatar, and every avatar is passed to `createGame` as a
  claim, so it keeps those assignments. `createGame`'s signature is unchanged.
- **Registration** (`routes/auth.ts`): usernames ending in ` NPC` are refused
  (400), so a person can't pass as a bot.
- **Pacing** (new `wizardTiming.ts`, used by `wizardGameRunner.ts`):
  - A bot waits `botPlayDelayMs` (4000, env `BOT_PLAY_DELAY_MS`) before
    playing a card, then checks it's still its turn.
  - A bot waits `botTrumpDelayMs` (2500, env `BOT_TRUMP_DELAY_MS`) before
    choosing trumps, then checks it's still choosing, so players can see
    who's choosing.
  - Bot predictions keep their existing pace.

## Rule change: a Wizard turned up for trumps

`wizardGameService.ts` `drawTrumpCard`: a turned-up **Wizard** now starts
`trump-selection` just as a Jester already did, so the round's first player
chooses the suit either way.

In the published Wizard rules it's the other way round: a Wizard means the
dealer chooses, and a Jester means no trump. This follows what was asked for
in this project; change it back if you'd rather follow the published rules.

## Rule change: the last prediction can't match the tricks

New `gameplayRulesConfig.ts` (tweakable) and `gameplayRules.ts` (logic, shared
with the visualiser):

- `forbiddenPrediction(players, tricksThisRound)`: for the round's last
  predictor, the number that would make everyone's predictions add up to the
  tricks in the round; null for anyone else, or when that number is out of
  range. `GAMEPLAY_RULES.lastPredictionCannotMatchTricks` switches the rule.
- `wizardGameService.ts` `submitPrediction` refuses it with an error.
- `wizardBotService.ts` `choosePrediction`: a bot that would pick it goes one
  lower (`npcForbiddenGoesLowerChance`, 75%) or one higher, within 0..tricks.
- `wizardGameRunner.ts`: a bot now waits `botPlayDelayMs` before predicting, as
  before playing a card, then checks it's still its prediction to make.

Predictions already ran in dealing order (from the round's starting player);
that's unchanged.

## Shorter games: max rounds

- New `models/rounds.ts`: `fullRoundCount(players)` (20/15/12/10), moved out
  of `wizardGameService.ts` so the waiting room can offer the right choices.
- `POST /wizard/games` accepts optional `maxRounds` (400 unless a whole number
  from 1 to the full game's rounds); `createGame(roomId, usernames, claims,
  maxRounds?)` uses it as `totalRounds`.
- `drawTrumpCard`: no trump card only when the deck is empty (a full game's
  last round). Before, that was keyed on `currentRound === totalRounds`, which
  would wrongly skip trumps in a shortened game's last round.
- `determineTrickWinner`'s final-round Wizard rule still applies to the game's
  last round, full or shortened.

## Playing from other devices

- `server.ts`: listens on `HOST` (default `127.0.0.1`), and CORS allows
  `CORS_ORIGINS` (comma separated; default the two localhost Vite origins).
  The default behaviour is unchanged.
- `npm run play` (new `scripts/play.mjs`, root) starts the backend and Vite for
  localhost, local Wi-Fi or Tailscale, setting those variables. See README,
  "Playing from other devices".
- Frontend: `src/services/api.ts` builds `API_BASE` (and the game socket URL)
  from the page's own hostname on port 3000, so a phone that loads the page
  from the host's address reaches the backend at that same address.

## Things noticed in existing code (not changed)

- `wizardGameService.test.ts` fails at line 63.
- `wizardBot.test.ts` hangs vitest.
- `Lobby.ts` inserts `room.name` into the page without escaping it, so a room
  name containing HTML runs as HTML for everyone who views the lobby (stored XSS).
- The REST play and prediction routes don't broadcast the new state or run
  the bot runner; only the socket messages do. The visualiser uses the socket,
  so this only matters for other clients.

## Keeping a live database across deployments

The database file is not in git (`.gitignore` covers `data/` and `*.sqlite`), so
a deployment never replaces it and its rows persist. Two pieces keep that true
when the shape of a table has to change:

- `db/migrations.ts`: a numbered list, applied once each against
  `PRAGMA user_version`, which SQLite stores in the file itself. `schema.sql`
  still creates whatever table is missing, which is all a new file needs, but it
  cannot alter a table that already exists - `CREATE TABLE IF NOT EXISTS` skips
  it whole. So a change to a live table means appending an entry here, never
  editing or reordering the ones above it. An entry has to be safe on a database
  already in the shape it wants, since the first ones describe changes that were
  once applied by hand.
- `db/snapshot.ts`: before any pending migration runs on an existing file,
  `VACUUM INTO` writes a consistent copy beside it
  (`wizard.before-v2.<timestamp>.sqlite`), keeping the newest five. A migration
  that goes wrong is undone by putting the copy back. Nothing is copied for a
  database that was just created, or on a start with nothing pending.

`DB_PATH` decides where the file lives; unset, it is `backend/data/wizard.sqlite`,
inside the deployed tree. On shared hosting point it somewhere a deployment
cannot reach, e.g. `DB_PATH=/home/<user>/wizard-data/wizard.sqlite`, and move the
existing file there once. The directory is created if it is missing.

## Seer and Trickster powers, scoring and elements (`foretold` branch, 2026-10)

For Carlos: what changed on the backend, and why. Everything below is on the
`foretold` branch; `master`, `Rufus` and `carlos` are untouched.

**Rules**

- Ranks 7 and 8 of every suit are now the **Trickster** (7) and the **Seer** (8).
  They are ordinary cards: they follow suit and rank by number like any other,
  and the deck is still 60 cards, so the rounds per player count are unchanged.
  `models/card.ts` has `TRICKSTER_VALUE`, `SEER_VALUE`, `CardPower` and
  `powerOf(card)`.
- **Win a trick with one and its winner may change a prediction by one.** The
  Seer changes the winner's own, the Trickster an opponent's. The new number is
  the old one -1, +0 or +1, kept within 0 to the round number (the cards dealt).
  Choosing the number already held means no change. There is no cap per round
  and it works on the last trick (the score is worked out after it). If a Wizard
  or a higher card wins the trick, nothing happens.
- Switch: `GAMEPLAY_RULES.cardPowersEnabled` in `gameplayRulesConfig.ts`.

**How it works**

- `TrickState.power` (`models/wizardGame.ts`): `{ kind, username, resolved,
  target, from, to }`. Set by `resolveTrick` when the winning card is a Seer or
  Trickster. It is part of the public state, because the visualiser announces
  from it. `target`, `from` and `to` stay `null` when nothing changed.
- New game phase **`"power"`** (in `WizardGameState` and `PublicWizardGameState`).
  The winner is already `currentPlayerIndex`, so the usual turn machinery
  applies: the turn timer, `turn_ready`, and `turnDeadlineAt`.
- `wizardGameService.ts`: `hasPendingPower`, `beginPower` (playing -> power),
  `usePower` (validates, applies, power -> playing) and `skipPower`.
  `advanceAfterTrick` refuses to clear a trick whose power is still pending.
- `wizardGameRunner.ts`: after the finished trick has been held, a pending power
  moves the game to `"power"` and waits for the winner. A bot decides after
  `botTrumpDelayMs`; a human who runs out of time leaves it alone (`skipPower`).
  After the power the trick is held for `WIZARD_TIMING.afterPowerHoldMs` and
  then cleared as before.
- New socket messages (`websocket/wizardSocket.ts`):
  `{ "type": "use_power", "target"?: string, "prediction": number }` (target is
  required for the Trickster and ignored for the Seer) and
  `{ "type": "skip_power" }`.
- Bots: `BotStrategy.choosePower` (`bots/personality.ts`).
  - The **Apprentice** (`bots/powers.ts`) only mends its own prediction with a
    Seer, when it can no longer come true, and never uses a Trickster.
  - The **Adept** (`bots/powerReasoning.ts`) works out what each prediction is
    worth. With `r` tricks left and `w` won, a player ends on `w + X`, X being
    0 to r more wins; a prediction's worth is its expected round score over that
    distribution of X (using the real scoring from `scoringRules.ts`). Its own
    X comes from the cards it still holds (the Poisson binomial of each card's
    chance of winning, as for its bidding); an opponent's, whose hand it can't
    see, is chance with an extra pull towards the exact bid they are playing for.
    - **Seer:** compare its own prediction with the one above and the one below,
      and move only if the neighbour is worth clearly more (margin 0.05). On the
      last trick nothing is left to chance, so it sets the prediction to the
      tricks it has won, if that is within one.
    - **Trickster:** for every opponent and each nudge (up or down, within 0 to
      the round), the points that nudge costs them; take the biggest loss, counted
      1.5 times as much against the leading opponent, and use it only if the loss is
      at least 0.3. Otherwise it is left unused. It never nudges towards what
      would help them.
    - **Playing the cards** (`bots/adept.ts`): when it wants the trick and plays
      last, a winning Trickster or Seer is chosen over the cheapest winner; when it
      has what it bid for but every card wins, it plays a Seer (it can raise its
      bid to match, so the extra trick costs nothing) and failing that a Trickster.
    - In a 180-game test (3 players, seats rotated) an Adept with this reasoning
      won 51% of games against Adepts using the simple rule (33% is even) and
      averaged 15.6 points against 6.3; with 4 players 32% against 25%.
- Tests: `services/cardPowers.test.ts` (rules, range, who may use it, scoring,
  bots). A simulation of 400 all-NPC games also ran without a stuck state.

**Scoring divided by ten** (earlier in the same branch)

- An exact prediction is now 2 plus 1 per trick won; a miss is -1 per trick of
  difference. The numbers live in the new `scoringRules.ts`, which the score
  calculator and the visualiser's round results both read.
- The profile level threshold in `src/pages/Profile.ts` moved from 200 to 20
  points per full game to match. Points already stored in a database are not
  converted.

**Things to know**

- The suits are still `Red`/`Green`/`Blue`/`Yellow` in the backend and the
  database. Only the visualiser shows them as Fire/Earth/Water/Air
  (`CARDS.suitElements`, and the `suit.*` strings in `src/i18n`).
- The old text interface (`src/pages/WizardGame.ts`) has no prompt for the
  `"power"` phase. A human there is left to the turn timer, which leaves the
  power unused; with "No limit" the game would wait for ever.
- German rank titles (`rank.*` in `src/i18n/de.ts`) are a first draft and want a
  native speaker's eye.
