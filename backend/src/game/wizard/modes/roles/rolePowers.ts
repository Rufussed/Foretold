import type { WizardGameState } from "../../models/wizardGame.js";
import { applySteal, findSteal } from "./thief.js";

// The one door from the game into the roles: after every card played in a
// Roles game, the power of its player's role, if it has one and it works
// now. What happened is kept with the trick, for the players to be told.
export function applyRolePowers(game: WizardGameState): void {
  const trick = game.currentTrick;
  const played = trick.playedCards.at(-1);
  const player = game.players.find((seat) => seat.username === played?.username);

  if (player?.role === "thief") {
    const steal = findSteal(trick.playedCards, game.trumpSuit);

    if (steal) {
      applySteal(trick.playedCards);
      trick.roleActions = [...(trick.roleActions ?? []), steal];
    }
  }
}
