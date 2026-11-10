import { isJester, isWizard, type Card } from "../game/wizard/models/card.js";
import type { PlayedCard, WizardGameState } from "../game/wizard/models/wizardGame.js";
import { normalizeGameOptions } from "../game/wizard/gameOptions.js";
import { isBotName } from "../game/wizard/models/bot.js";
import { logEvent, logsPlays } from "./eventLog.js";

// The game's moments for the event log (eventLog.ts), in every mode: the
// start, each card and trick (only while plays are logged), each round's
// result. The game code calls these with one line each.

export const cardText = (card: Card): string =>
  isWizard(card) ? "Wizard" : isJester(card) ? "Jester" : `${card.suit} ${card.value}`;

const usersOf = (game: WizardGameState): string[] => game.players.map((player) => player.username);

export function logGameStarted(game: WizardGameState): void {
  const options = normalizeGameOptions(game.options);
  logEvent("game-started", {
    room: game.roomId,
    users: usersOf(game),
    mode: options.mode,
    rounds: game.totalRounds,
    seats: game.players.map((player) => ({
      name: player.username,
      ...(isBotName(player.username) ? { npc: player.botPersonality ?? "apprentice" } : {}),
      ...(player.role ? { role: player.role } : {}),
      ...(player.masterRole ? { masterRole: player.masterRole } : {}),
    })),
  });
}

// A card just played, with what the roles' powers did with it.
export function logCardPlayed(game: WizardGameState, played: PlayedCard, actionsBefore: number): void {
  if (!logsPlays()) return;
  const actions = (game.currentTrick.roleActions ?? []).slice(actionsBefore);
  logEvent("card-played", {
    room: game.roomId,
    users: [played.playedBy ?? played.username],
    round: game.currentRound,
    card: cardText(played.card),
    ...(played.byServer ? { byServer: true } : {}),
    ...(actions.length ? { powers: actions.map((action) => ({ role: action.role, by: action.by, on: action.on, ...(action.points !== undefined ? { points: action.points } : {}) })) } : {}),
  });
}

export function logTrickWon(game: WizardGameState, winner: string): void {
  if (!logsPlays()) return;
  logEvent("trick-won", {
    room: game.roomId,
    users: [winner],
    round: game.currentRound,
    cards: game.currentTrick.playedCards.map((played) => `${played.playedBy ?? played.username}: ${cardText(played.card)}${played.username !== (played.playedBy ?? played.username) ? ` (now ${played.username})` : ""}`),
  });
}

// Once a round is scored: each player's bid, tricks, points and total.
export function logRoundEnded(game: WizardGameState): void {
  logEvent("round-ended", {
    room: game.roomId,
    users: usersOf(game),
    round: game.currentRound,
    of: game.totalRounds,
    results: game.players.map((player) => {
      const round = player.roundScores.at(-1);
      return {
        name: player.username,
        bid: round?.prediction,
        tricks: round?.tricksWon,
        points: round?.score,
        ...(round?.roleBonuses && Object.keys(round.roleBonuses).length ? { rolePoints: round.roleBonuses } : {}),
        total: player.score,
      };
    }),
  });
}
