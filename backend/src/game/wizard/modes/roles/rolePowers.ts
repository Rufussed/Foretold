import { normalizeGameOptions } from "../../gameOptions.js";
import type { Suit } from "../../models/card.js";
import type { GamePlayer, PlayedCard, WizardGameState } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { harvest, plant, plantedBy } from "./farmer.js";
import { botCatch, CATCH_POINTS, fish, fishingSpots, nextFisher, randomCatch } from "./fisher.js";
import { playerOf, swapLastTwo, type RoleOf } from "./rolePlay.js";
import { findService, SERVANT_BONUS, SERVICE_POINTS, tippers } from "./servant.js";
import { collect, giveSheep, laidBy } from "./shepherd.js";
import { steal, STEAL_POINTS, stealSpots } from "./thief.js";
import type { RoleAction, RoleId } from "./roles.js";

const rules = new WizardRules();

// Who holds which role in this game.
export const rolesOf = (game: WizardGameState): RoleOf => (username) =>
  game.players.find((player) => player.username === username)?.role;

// The power the trick's last card sets off at once, if any: a Servant just
// before it receiving it, or a Thief's 1 stealing - the card at stealSpot
// when it is one the 1 may take, else the one nearest it. Swaps the owners in
// playedCards; the bots use it on a copy to look ahead.
export function playPower(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  stealSpot?: number,
): RoleAction | null {
  const service = findService(playedCards, trumpSuit, roleOf);

  if (service) {
    swapLastTwo(playedCards);
    return service;
  }

  const spots = stealSpots(playedCards, trumpSuit, roleOf);
  const spot = stealSpot !== undefined && spots.includes(stealSpot) ? stealSpot : spots.at(-1);

  return spot === undefined ? null : steal(playedCards, spot);
}

// The doors from the game into the roles. After every card played in a
// Roles game, the power it sets off, if any - a Servant receiving it, or a
// Thief stealing with it. What happened is kept with the trick, for the
// players to be told.
export function applyRolePowers(game: WizardGameState, stealSpot?: number): void {
  const trick = game.currentTrick;
  const action = playPower(trick.playedCards, game.trumpSuit, rolesOf(game), stealSpot);

  if (action) {
    trick.roleActions = [...(trick.roleActions ?? []), action];
  }

  if (action?.role === "thief") {
    action.points = movePoints(game, action.on, action.by, "thief", STEAL_POINTS);
  }
  if (action?.role === "servant") {
    action.points = movePoints(game, action.on, action.by, "servant", SERVICE_POINTS);
  }
}

// Points a role's power moves, straight onto the score and into this round's
// roleBonuses for the results.
function addBonus(player: GamePlayer, role: RoleId, points: number): void {
  if (!points) {
    return;
  }

  player.score += points;
  player.roleBonuses = {
    ...player.roleBonuses,
    [role]: (player.roleBonuses?.[role] ?? 0) + points,
  };
}

// Points a role's power takes from one player for another: never more than
// the giver has, so nothing from 0 or below. Returns the points moved.
function movePoints(game: WizardGameState, from: string, to: string, role: RoleId, points: number): number {
  const giver = game.players.find((player) => player.username === from);
  const taker = game.players.find((player) => player.username === to);

  if (!giver || !taker) {
    return 0;
  }

  const moved = Math.min(points, Math.max(0, giver.score));

  addBonus(taker, role, moved);
  addBonus(giver, role, -moved);

  return moved;
}

// The Farmers at the end of a trick: the winner takes a seed from each
// Farmer's 4 in the trick.
function applyFarming(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;

  for (const { farmer, card } of plantedBy(trick.playedCards, rolesOf(game))) {
    if (plant(winner, farmer)) {
      actions.push({ role: "farmer", by: farmer, on: winner.username, card });
    }
  }

  return actions;
}

// The Shepherds at the end of a trick: a Shepherd who won it with their own 5
// is paid for their sheep first, then the winner takes a sheep from each
// other Shepherd's 5 in the trick.
function applyShepherding(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;
  const won = trick.playedCards.find((played) => played.username === winner.username);

  if (won && playerOf(won) === winner.username && laidBy([won], rolesOf(game)).length) {
    for (const { holder, points } of collect(game.players, winner.username)) {
      addBonus(winner, "shepherd", points);
      addBonus(holder, "shepherd", -points);
      // A payment of nothing is still told: the sheep are home.
      actions.push({ role: "shepherd", by: winner.username, on: holder.username, card: won.card, points });
    }
  }

  for (const { shepherd, card } of laidBy(trick.playedCards, rolesOf(game))) {
    if (giveSheep(game.players, winner, shepherd)) {
      actions.push({ role: "shepherd", by: shepherd, on: winner.username, card });
    }
  }

  return actions;
}

// When a trick is won in a Roles game: what the powers used in it bring, or
// cost, straight onto the scores.
export function applyTrickEndPowers(game: WizardGameState, winner: GamePlayer): void {
  const trick = game.currentTrick;

  for (const served of tippers(trick.roleActions, winner.username)) {
    movePoints(game, served, winner.username, "servant", SERVANT_BONUS);
  }
  // A Fisher's catch that won them the trick is paid for by the player fished.
  for (const action of trick.roleActions ?? []) {
    if (action.role === "fisher" && action.by === winner.username) {
      action.points = movePoints(game, action.on, winner.username, "fisher", CATCH_POINTS);
    }
  }

  const atTrickEnd = [...applyFarming(game, winner), ...applyShepherding(game, winner)];

  if (atTrickEnd.length) {
    trick.roleActions = [...(trick.roleActions ?? []), ...atTrickEnd];
  }
}

// Once a Roles game's round is scored: each Farmer who made their prediction
// exactly harvests all their seeds, against the scores with this round's
// points in. The points go into the round's results too, beside the role
// bonuses from its tricks.
export function applyRoundEndPowers(game: WizardGameState): void {
  for (const farmer of game.players) {
    const round = farmer.roundScores.at(-1);

    if (farmer.role !== "farmer" || !round || round.prediction !== round.tricksWon) {
      continue;
    }

    for (const { holder, points } of harvest(game.players, farmer.username)) {
      addRoundPoints(farmer, points);
      addRoundPoints(holder, -points);
    }
  }
}

// Points onto a score and into the last round's results, as the Farmer's.
function addRoundPoints(player: GamePlayer, points: number): void {
  const round = player.roundScores.at(-1);

  if (!points || !round) {
    return;
  }

  player.score += points;
  round.roleBonuses = { ...round.roleBonuses, farmer: (round.roleBonuses?.farmer ?? 0) + points };
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
