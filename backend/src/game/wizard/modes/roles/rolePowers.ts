import { normalizeGameOptions } from "../../gameOptions.js";
import type { GamePlayer, PlayedCard, WizardGameState } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { botCatch, fish, fishingSpots, nextFisher, randomCatch } from "./fisher.js";
import { playerOf, swapLastTwo, type RoleOf } from "./rolePlay.js";
import { findService, servantBonus } from "./servant.js";
import { findSteal } from "./thief.js";

const rules = new WizardRules();

const rolesOf = (game: WizardGameState): RoleOf => (username) =>
  game.players.find((player) => player.username === username)?.role;

// The doors from the game into the roles. After every card played in a
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

// When a Roles game's trick is complete: if a Fisher is left to choose, the
// game waits for them in the fishing phase, their move. False when none is.
export function startFishing(game: WizardGameState): boolean {
  const trick = game.currentTrick;
  const three = nextFisher(trick.playedCards, trick.roleActions, game.trumpSuit, rolesOf(game));
  const fisher = three === null ? undefined : trick.playedCards[three];

  if (!fisher) {
    return false;
  }

  game.phase = "fishing";
  game.currentPlayerIndex = game.players.findIndex((player) => player.username === playerOf(fisher));

  return true;
}

// The cards the Fisher whose move it is may fish, by place in the trick.
export function spotsToFish(game: WizardGameState): number[] {
  const fisher = game.players[game.currentPlayerIndex]?.username;
  const playedCards = game.currentTrick.playedCards;
  const three = playedCards.findIndex((played) => playerOf(played) === fisher);

  return fishingSpots(playedCards, three);
}

// The Fisher whose move it is takes the card at this place in the trick.
export function applyFishing(game: WizardGameState, username: string, spot: number): void {
  if (game.phase !== "fishing") {
    throw new Error("Nothing to fish right now");
  }
  if (game.players[game.currentPlayerIndex]?.username !== username) {
    throw new Error("It is not your turn to fish");
  }
  if (!spotsToFish(game).includes(spot)) {
    throw new Error("That card cannot be fished");
  }

  const trick = game.currentTrick;

  trick.roleActions = [...(trick.roleActions ?? []), fish(trick.playedCards, username, spot)];
}

// A bot's or a quit player's catch, as the bots predict: wanted tricks first.
export function botFishingSpot(game: WizardGameState): number {
  const fisher = game.players[game.currentPlayerIndex];
  const wizardWins = normalizeGameOptions(game.options).wizardWins;
  const winsWith = (spot: number): boolean => {
    const copy: PlayedCard[] = game.currentTrick.playedCards.map((played) => ({ ...played }));

    fish(copy, fisher?.username ?? "", spot);

    return rules.determineTrickWinner(copy, game.trumpSuit, wizardWins) === fisher?.username;
  };
  const wantsTricks = (fisher?.prediction ?? 0) > (fisher?.tricksWon ?? 0);

  return botCatch(spotsToFish(game), winsWith, wantsTricks);
}

// A human whose time ran out: a card at random.
export const randomFishingSpot = (game: WizardGameState): number =>
  randomCatch(spotsToFish(game));
