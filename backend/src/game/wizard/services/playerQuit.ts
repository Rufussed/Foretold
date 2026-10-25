import { isBotName } from "../models/bot.js";
import type { GamePlayer, WizardGameState } from "../models/wizardGame.js";
import { normalizeGameOptions } from "../gameOptions.js";

// A player who quits keeps their seat, score and cards, and the server plays
// the seat from then on, as it plays a bot's: the others go on without
// waiting. A player quits by choice (POST /wizard/games/:roomId/quit) or by
// missing as many turns in a row as the room set up (missedTurnsToQuit in
// gameOptions.ts) with the turn timer running.

export function hasQuit(game: WizardGameState, username: string): boolean {
  return game.players.some(
    (player) => player.username === username && player.quit === true,
  );
}

// Seats the server plays: bots, and players who quit.
export function isPlayedByServer(player: GamePlayer): boolean {
  return isBotName(player.username) || player.quit === true;
}

// The humans still playing their own seats.
export function activeHumans(game: WizardGameState): GamePlayer[] {
  return game.players.filter((player) => !isPlayedByServer(player));
}

export function quitPlayer(game: WizardGameState, username: string): void {
  const player = game.players.find(
    (candidate) => candidate.username === username,
  );

  if (player) {
    player.quit = true;
    player.missedTurns = 0;
  }
}

// A move of their own: the missed turns start again from none.
export function recordOwnMove(game: WizardGameState, username: string): void {
  const player = game.players.find(
    (candidate) => candidate.username === username,
  );

  if (player) {
    player.missedTurns = 0;
  }
}

// The timer ran out on this player. After the room's number of times in a
// row they have quit - unless the room turned that off, or they are the only
// human left, whose game would then end: a player alone with bots (a guest,
// say) is never put out, the bot only makes that one move. Returns true when
// the player quit just now.
export function recordMissedTurn(
  game: WizardGameState,
  username: string,
): boolean {
  const player = game.players.find(
    (candidate) => candidate.username === username,
  );

  if (!player || isPlayedByServer(player)) {
    return false;
  }

  player.missedTurns = (player.missedTurns ?? 0) + 1;

  const limit = normalizeGameOptions(game.options).missedTurnsToQuit;

  if (
    limit !== null &&
    player.missedTurns >= limit &&
    activeHumans(game).length > 1
  ) {
    quitPlayer(game, username);
    return true;
  }

  return false;
}
