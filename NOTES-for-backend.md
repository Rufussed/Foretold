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
  `"<name> NPC"`, e.g. `Morgana NPC`, drawn at random from the editable list in
  `botNames.ts`. The ` NPC` suffix is now what marks a bot:
  `WizardBotService.isBot` uses `isBotName` instead of `startsWith("bot-")`.
  `wizardBot.test.ts` data updated to match.
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
