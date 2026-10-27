import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";
import { swapLastTwo, type RoleOf } from "./rolePlay.js";
import { findService, servantBonus } from "./servant.js";
import { findSteal } from "./thief.js";

const rolesOf = (game: WizardGameState): RoleOf => (username) =>
  game.players.find((player) => player.username === username)?.role;

// The one door from the game into the roles: after every card played in a
// Roles game, the power it sets off, if any - a Servant receiving it, or a
// Thief stealing with it. What happened is kept with the trick, for the
// players to be told.
export function applyRolePowers(game: WizardGameState): void {
  const trick = game.currentTrick;
  const roleOf = rolesOf(game);
  const action =
    findService(trick.playedCards, game.trumpSuit, roleOf)
    ?? findSteal(trick.playedCards, game.trumpSuit, roleOf);

  if (action) {
    swapLastTwo(trick.playedCards);
    trick.roleActions = [...(trick.roleActions ?? []), action];
  }
}

// When a trick is won in a Roles game: what the powers used in it bring the
// winner, straight onto their score.
export function applyTrickEndPowers(game: WizardGameState, winner: GamePlayer): void {
  const bonus = servantBonus(game.currentTrick.roleActions, winner.username);

  if (bonus) {
    winner.score += bonus;
    winner.roleBonuses = {
      ...winner.roleBonuses,
      servant: (winner.roleBonuses?.servant ?? 0) + bonus,
    };
  }
}
