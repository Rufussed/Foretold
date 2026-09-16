# Backend changes from the 3D visualiser work

Notes for whoever owns the backend. While building the three.js visualiser
(`src/visualizer/`), a few backend changes were needed. Everything below is in
the working tree; nothing about the existing game rules changed except where
marked **rule change**.

## Avatars and the waiting room

Players pick one of six avatars before a game starts, first come first served.

- `db/schema.sql`: `room_players` has a new `avatar TEXT` column.
- `db/database.ts`: after `db.exec(schema)`, adds that column to existing
  databases if it's missing (`PRAGMA table_info` then `ALTER TABLE`), then
  creates the unique index `room_players_avatar_unique ON room_players(room_id, avatar)`.
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
