import { normalizeGameOptions } from "../../gameOptions.js";
import type { Suit } from "../../models/card.js";
import type { GamePlayer, PlayedCard, WizardGameState } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { harvest, plant, plantedBy } from "./farmer.js";
import { MARKET_POINTS, marketsIn, trades } from "./merchant.js";
import { botCatch, CATCH_POINTS, fish, fishingSpots, nextFisher, randomCatch } from "./fisher.js";
import { ALMS_POINTS, FAITH_POINTS, poorFor, priestsIn, royalsFor } from "./priest.js";
import { battlesIn, PRIDE_POINTS, VICTORY_POINTS } from "./warrior.js";
import { BET_LOSS_POINTS, BET_WIN_POINTS, betsIn } from "./gambler.js";
import { FORESIGHT_POINTS, foresightsIn } from "./prophet.js";
import { botGrant, dukeWinning, GRANT_POINTS, KEEP_POINTS } from "./duke.js";
import { kingsPeace, playerOf, swapLastTwo, swapOwners, type RoleOf } from "./rolePlay.js";
import { bringsPeace, PEACE_POINTS, peaceTribute, stoppedBy, TAX_POINTS, taxIn } from "./king.js";
import { findService, SERVANT_BONUS, SERVICE_POINTS, tippers } from "./servant.js";
import { colourWizardBonus, isColourWizard } from "./master/colourWizards.js";
import { trickRolesIn } from "./master/trickRoles.js";
import { collect, giveSheep, laidBy } from "./shepherd.js";
import { block, BLOCK_POINTS, forge, forgesArmor } from "./smith.js";
import { steal, STEAL_POINTS, stealSpots } from "./thief.js";
import { roleCard, type RoleAction, type RoleId } from "./roles.js";

const rules = new WizardRules();

// Who holds which role in this game.
export const rolesOf = (game: WizardGameState): RoleOf => (username) =>
  game.players.find((player) => player.username === username)?.role;

// The pieces of armour each player wears; only Smiths have any.
export const armorOf = (game: WizardGameState) => (username: string): number =>
  game.players.find((player) => player.username === username)?.armor ?? 0;

// A power used against a Smith in armour: what the block looks like, the
// Smith's action on the attacker.
const blockedBy = (smith: string, attacker: string, played: PlayedCard): RoleAction =>
  ({ role: "smith", by: smith, on: attacker, card: played.card });

// The power the trick's last card sets off at once, if any: a Servant just
// before it receiving it, or a Thief's 1 stealing - the card at stealSpot
// when it is one the 1 may take, else the one nearest it. Either is blocked
// when it is a Smith's card and they wear armour. Swaps the owners in
// playedCards; the bots use it on a copy to look ahead.
export function playPower(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  stealSpot?: number,
  armor: (username: string) => number = () => 0,
): RoleAction | null {
  const service = findService(playedCards, trumpSuit, roleOf);
  const last = playedCards.at(-1);

  if (service && last) {
    if (armor(service.on)) {
      return blockedBy(service.on, service.by, last);
    }
    swapLastTwo(playedCards);
    return service;
  }

  const spots = stealSpots(playedCards, trumpSuit, roleOf);
  const spot = stealSpot !== undefined && spots.includes(stealSpot) ? stealSpot : spots.at(-1);
  const target = spot === undefined ? undefined : playedCards[spot];

  if (spot === undefined || !target || !last) {
    return null;
  }

  return armor(target.username) ? blockedBy(target.username, last.username, target) : steal(playedCards, spot);
}

// A Smith's armour used up on a block, and the points bounced back from the
// attacker.
function bounce(game: WizardGameState, action: RoleAction): void {
  block(game.players.find((player) => player.username === action.by));
  action.points = movePoints(game, action.on, action.by, "smith", BLOCK_POINTS);
}

// The doors from the game into the roles. After every card played in a
// Roles game, the power it sets off, if any - a Servant receiving it, or a
// Thief stealing with it. What happened is kept with the trick, for the
// players to be told.
export function applyRolePowers(game: WizardGameState, stealSpot?: number): void {
  const trick = game.currentTrick;
  const roleOf = rolesOf(game);

  if (bringsPeace(trick.playedCards, trick.playedCards.length - 1, game.trumpSuit, roleOf)) {
    applyPeace(game);
    return;
  }
  const action = playPower(trick.playedCards, game.trumpSuit, roleOf, stealSpot, armorOf(game));

  if (action) {
    trick.roleActions = [...(trick.roleActions ?? []), action];
  }

  if (action?.role === "smith") {
    bounce(game, action);
  }

  if (action?.role === "thief") {
    action.points = movePoints(game, action.on, action.by, "thief", STEAL_POINTS);
  }
  if (action?.role === "servant") {
    action.points = movePoints(game, action.on, action.by, "servant", SERVICE_POINTS);
  }

  applyForging(game);
}

// A King's trump 13 just played: every power already used in the trick is
// undone, latest first, and the peace is told, with whom it stopped.
function applyPeace(game: WizardGameState): void {
  const trick = game.currentTrick;
  const playedCards = trick.playedCards;
  const thirteen = playedCards.at(-1)!;
  const king = playerOf(thirteen);
  const named = (username: string) => game.players.find((player) => player.username === username);
  const sameCard = (played: PlayedCard, action: RoleAction) =>
    played.card.suit === action.card.suit && played.card.value === action.card.value;

  for (const action of [...(trick.roleActions ?? [])].reverse()) {
    if (action.undone) continue;
    action.undone = true;

    if (action.role === "thief" || action.role === "servant") {
      // The card taken or received goes back for the role's own card.
      const taken = playedCards.find((played) => sameCard(played, action));
      const own = playedCards.find((played) =>
        playerOf(played) === action.by && played.card.value === roleCard(action.role));
      if (taken && own) swapOwners(taken, own);
      const by = named(action.by);
      const on = named(action.on);
      if (by && on && action.points) {
        addBonus(by, action.role, -action.points);
        addBonus(on, action.role, action.points);
      }
    } else if (action.role === "smith") {
      const smith = named(action.by);
      if (smith && action.points === undefined) {
        // Armour forged with a 6 goes again.
        smith.armor = Math.max(0, (smith.armor ?? 0) - 1);
      } else if (smith) {
        // A block: the piece comes back, and the points go back.
        smith.armor = (smith.armor ?? 0) + 1;
        const attacker = named(action.on);
        if (attacker && action.points) {
          addBonus(smith, "smith", -action.points);
          addBonus(attacker, "smith", action.points);
        }
      }
    }
  }

  const stopped = stoppedBy(playedCards, playedCards.length - 1, game.trumpSuit, rolesOf(game));
  trick.roleActions = [...(trick.roleActions ?? []), { role: "king", by: king, on: king, card: thirteen.card, stopped }];
}

// A Smith's 6 just played, with its power on: a piece of armour, if they
// have room for it.
function applyForging(game: WizardGameState): void {
  const trick = game.currentTrick;
  const six = trick.playedCards.at(-1);
  const smith = six && game.players.find((player) => player.username === playerOf(six));

  if (!six || !smith || !forgesArmor(trick.playedCards, game.trumpSuit, rolesOf(game)) || !forge(smith)) {
    return;
  }

  trick.roleActions = [...(trick.roleActions ?? []), { role: "smith", by: smith.username, on: smith.username, card: six.card }];
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
    for (const { holder, points, blocked } of collect(game.players, winner.username, block)) {
      addBonus(winner, "shepherd", points);
      addBonus(holder, "shepherd", -points);
      // A payment of nothing is still told: the sheep are home.
      actions.push({ role: "shepherd", by: winner.username, on: holder.username, card: won.card, points });
      // A Smith's armour, one piece per sheep, bounces points back.
      if (blocked) {
        const bounced = movePoints(game, winner.username, holder.username, "smith", blocked * BLOCK_POINTS);
        actions.push({ role: "smith", by: holder.username, on: winner.username, card: won.card, points: bounced });
      }
    }
  }

  for (const { shepherd, card } of laidBy(trick.playedCards, rolesOf(game))) {
    if (giveSheep(game.players, winner, shepherd)) {
      actions.push({ role: "shepherd", by: shepherd, on: winner.username, card });
    }
  }

  return actions;
}

// The Merchants' markets at the end of a trick, once every swap is done.
// Whoever sells pays the Merchant, never more than they have; the Merchant
// pays whoever buys in full, even below 0. A Smith in armour who would pay
// uses up a piece instead: the trade does not happen, and the Merchant pays
// the Smith BLOCK_POINTS for the block.
function applyMarkets(game: WizardGameState): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;
  const playerNamed = (username: string) => game.players.find((player) => player.username === username);

  for (const { merchant, card } of marketsIn(trick.playedCards, game.trumpSuit, rolesOf(game))) {
    const done: { player: string; points: number }[] = [];
    const blocks: RoleAction[] = [];

    for (const trade of trades(trick.playedCards, merchant, game.trumpSuit, trickRolesIn(game))) {
      if (!trade.sells) {
        const buyer = playerNamed(merchant);
        const seller = playerNamed(trade.player);
        if (buyer && seller) {
          addBonus(seller, "merchant", MARKET_POINTS);
          addBonus(buyer, "merchant", -MARKET_POINTS);
        }
        done.push({ player: trade.player, points: -MARKET_POINTS });
      } else if (armorOf(game)(trade.player)) {
        block(playerNamed(trade.player));
        // The trade does not happen, and the Merchant pays for the block.
        const bounced = movePoints(game, merchant, trade.player, "smith", BLOCK_POINTS);
        blocks.push({ role: "smith", by: trade.player, on: merchant, card: trade.card, points: bounced });
      } else {
        done.push({ player: trade.player, points: movePoints(game, trade.player, merchant, "merchant", MARKET_POINTS) });
      }
    }

    if (done.length) {
      const points = done.reduce((sum, trade) => sum + trade.points, 0);
      actions.push({ role: "merchant", by: merchant, on: merchant, card, points, trades: done });
    }
    actions.push(...blocks);
  }

  return actions;
}

// The Priests' faith at the end of a trick, once every swap is done: every
// royal card in it pays the Priest, never more than its player has. A Smith
// in armour uses up a piece instead, and the Priest pays them for the block,
// as at a market. A Priest whose 8 won the trick then feeds the poor: every
// card under 8 is paid in full, even if that takes the Priest below 0.
function applyFaith(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;

  for (const { priest, card } of priestsIn(trick.playedCards, game.trumpSuit, rolesOf(game))) {
    const paid: { player: string; points: number }[] = [];
    const blocks: RoleAction[] = [];

    for (const royal of royalsFor(trick.playedCards, priest)) {
      if (armorOf(game)(royal.player)) {
        block(game.players.find((player) => player.username === royal.player));
        const bounced = movePoints(game, priest, royal.player, "smith", BLOCK_POINTS);
        blocks.push({ role: "smith", by: royal.player, on: priest, card: royal.card, points: bounced });
      } else {
        paid.push({ player: royal.player, points: movePoints(game, royal.player, priest, "priest", FAITH_POINTS) });
      }
    }

    const giver = game.players.find((player) => player.username === priest);
    for (const poor of poorFor(trick.playedCards, priest, winner.username)) {
      const fed = game.players.find((player) => player.username === poor.player);
      if (giver && fed) {
        addBonus(fed, "priest", ALMS_POINTS);
        addBonus(giver, "priest", -ALMS_POINTS);
      }
      paid.push({ player: poor.player, points: -ALMS_POINTS });
    }

    if (paid.length) {
      const points = paid.reduce((sum, faith) => sum + faith.points, 0);
      actions.push({ role: "priest", by: priest, on: priest, card, points, trades: paid });
    }
    actions.push(...blocks);
  }

  return actions;
}

// The Warriors' battles at the end of a trick, once every swap is done. A
// Warrior whose 9 won is paid by every other player, never more than they
// have; a Smith in armour uses up a piece instead, and the Warrior pays them
// for the block. A
// Warrior whose trump 9 lost pays every other player in full, even if that
// takes them below 0.
function applyBattles(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;

  for (const { warrior, card, won } of battlesIn(trick.playedCards, game.trumpSuit, rolesOf(game), winner.username)) {
    const paid: { player: string; points: number }[] = [];
    const blocks: RoleAction[] = [];
    const proud = game.players.find((player) => player.username === warrior);

    for (const other of game.players) {
      if (other.username === warrior) continue;
      if (!won) {
        if (proud) {
          addBonus(other, "warrior", PRIDE_POINTS);
          addBonus(proud, "warrior", -PRIDE_POINTS);
        }
        paid.push({ player: other.username, points: -PRIDE_POINTS });
      } else if (armorOf(game)(other.username)) {
        block(other);
        const bounced = movePoints(game, warrior, other.username, "smith", BLOCK_POINTS);
        blocks.push({ role: "smith", by: other.username, on: warrior, card, points: bounced });
      } else {
        paid.push({ player: other.username, points: movePoints(game, other.username, warrior, "warrior", VICTORY_POINTS) });
      }
    }

    if (paid.length) {
      const points = paid.reduce((sum, entry) => sum + entry.points, 0);
      actions.push({ role: "warrior", by: warrior, on: warrior, card, points, trades: paid });
    }
    actions.push(...blocks);
  }

  return actions;
}

// The Gamblers' bets at the end of a trick. A 10 that won brings its Gambler
// BET_WIN_POINTS; one that lost costs them BET_LOSS_POINTS, lost to the house
// in full, even below 0. Either way the action is on the Gambler.
function applyBets(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const actions: RoleAction[] = [];
  const trick = game.currentTrick;

  for (const { gambler, card, won } of betsIn(trick.playedCards, game.trumpSuit, rolesOf(game), winner.username)) {
    const player = game.players.find((candidate) => candidate.username === gambler);
    if (!player) continue;
    if (won) {
      addBonus(player, "gambler", BET_WIN_POINTS);
      actions.push({ role: "gambler", by: gambler, on: gambler, card, points: BET_WIN_POINTS });
    } else {
      addBonus(player, "gambler", -BET_LOSS_POINTS);
      actions.push({ role: "gambler", by: gambler, on: gambler, card, points: -BET_LOSS_POINTS });
    }
  }

  return actions;
}

// The Prophets who kept their prediction and won the trick with their 12.
function applyForesight(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const trick = game.currentTrick;

  return foresightsIn(trick.playedCards, game.trumpSuit, rolesOf(game), winner.username).map(({ prophet, card }) => {
    addBonus(winner, "prophet", FORESIGHT_POINTS);
    return { role: "prophet", by: prophet, on: prophet, card, points: FORESIGHT_POINTS };
  });
}

// The tribute for the King's peace: every other player but the Priest pays
// the King whose trump 13 won, never more than they have. No armour blocks
// it: the peace stops the Smith too.
function applyTribute(game: WizardGameState, winner: GamePlayer): void {
  const trick = game.currentTrick;
  const players = game.players.map((player) => player.username);
  const tribute = peaceTribute(trick.playedCards, game.trumpSuit, rolesOf(game), winner.username, players);
  if (!tribute?.payers.length) return;

  const paid = tribute.payers.map((player) => ({ player, points: movePoints(game, player, tribute.king, "king", PEACE_POINTS) }));
  const points = paid.reduce((sum, entry) => sum + entry.points, 0);
  trick.roleActions = [...(trick.roleActions ?? []), { role: "king", by: tribute.king, on: tribute.king, card: tribute.card, points, trades: paid }];
}

// The King's tax at the end of a trick his own 13 won, not as a trump:
// every other card showing its seal pays him, never more than its player
// has; the Priest pays none. A Smith in armour uses up a piece instead, and
// the King pays them for the block.
function applyTax(game: WizardGameState, winner: GamePlayer): RoleAction[] {
  const tax = taxIn(game.currentTrick.playedCards, game.trumpSuit, rolesOf(game), winner.username);
  if (!tax?.payers.length) return [];

  const paid: { player: string; points: number }[] = [];
  const blocks: RoleAction[] = [];

  for (const { player, card } of tax.payers) {
    if (armorOf(game)(player)) {
      block(game.players.find((candidate) => candidate.username === player));
      const bounced = movePoints(game, tax.king, player, "smith", BLOCK_POINTS);
      blocks.push({ role: "smith", by: player, on: tax.king, card, points: bounced });
    } else {
      paid.push({ player, points: movePoints(game, player, tax.king, "king", TAX_POINTS) });
    }
  }

  const actions: RoleAction[] = [];
  if (paid.length) {
    const points = paid.reduce((sum, entry) => sum + entry.points, 0);
    actions.push({ role: "king", by: tax.king, on: tax.king, card: tax.card, points, trades: paid });
  }
  return [...actions, ...blocks];
}

// When a trick is won in a Roles game: what the powers used in it bring, or
// cost, straight onto the scores.
export function applyTrickEndPowers(game: WizardGameState, winner: GamePlayer): void {
  const trick = game.currentTrick;

  // A colour Wizard who won with the Wizard of their colour: the King's
  // peace does not stop it.
  if (isColourWizard(winner.role)) addBonus(winner, winner.role, colourWizardBonus(trick, winner));

  // Under the King's peace no other power works at the end of the trick;
  // a King who won it with his trump 13 is paid his tribute.
  if (kingsPeace(trick.playedCards, game.trumpSuit, rolesOf(game))) {
    applyTribute(game, winner);
    return;
  }

  for (const served of tippers(trick.roleActions, winner.username)) {
    movePoints(game, served, winner.username, "servant", SERVANT_BONUS);
  }
  // A Fisher's catch that won them the trick is paid for by the player fished.
  for (const action of trick.roleActions ?? []) {
    if (action.role === "fisher" && action.by === winner.username) {
      action.points = movePoints(game, action.on, winner.username, "fisher", CATCH_POINTS);
    }
  }

  const atTrickEnd = [...applyFarming(game, winner), ...applyShepherding(game, winner), ...applyMarkets(game), ...applyFaith(game, winner), ...applyBattles(game, winner), ...applyBets(game, winner), ...applyForesight(game, winner), ...applyTax(game, winner)];

  if (atTrickEnd.length) {
    trick.roleActions = [...(trick.roleActions ?? []), ...atTrickEnd];
  }

  applyGrant(game, winner);
}

// The Duke who won the complete trick with their own 11, if one did, before
// it is resolved.
function dukeOf(game: WizardGameState): PlayedCard | undefined {
  const trick = game.currentTrick;
  const winner = rules.determineTrickWinner(
    trick.playedCards,
    game.trumpSuit,
    normalizeGameOptions(game.options).wizardWins,
    trickRolesIn(game),
  );

  return winner ? dukeWinning(trick.playedCards, game.trumpSuit, rolesOf(game), winner) : undefined;
}

// When a Roles game's trick is complete and every Fisher has fished: if a
// Duke's 11 wins it, the game waits for them to keep or grant it in the
// granting phase, their move. False when there is nothing to choose.
export function startGranting(game: WizardGameState): boolean {
  const eleven = dukeOf(game);

  if (!eleven || game.currentTrick.grantedTo !== undefined) {
    return false;
  }

  game.phase = "granting";
  game.currentPlayerIndex = game.players.findIndex((player) => player.username === eleven.username);

  return true;
}

// The Duke whose move it is keeps the trick (to null) or grants it to this
// player.
export function applyGranting(game: WizardGameState, username: string, to: string | null): void {
  if (game.phase !== "granting") {
    throw new Error("Nothing to grant right now");
  }
  if (game.players[game.currentPlayerIndex]?.username !== username) {
    throw new Error("It is not your turn to grant");
  }
  if (to !== null && (to === username || !game.players.some((player) => player.username === to))) {
    throw new Error("That player cannot be granted the trick");
  }

  game.currentTrick.grantedTo = to;
}

// A bot's or a quit player's choice, as the bots see it.
export function botGrantTo(game: WizardGameState): string | null {
  const duke = game.players[game.currentPlayerIndex];

  return duke ? botGrant(duke, game.players) : null;
}

// The Duke's choice settled, once the trick's powers are: kept, they earn
// KEEP_POINTS; granted, the trick moves to the player chosen, whom the Duke
// pays GRANT_POINTS in full.
function applyGrant(game: WizardGameState, winner: GamePlayer): void {
  const trick = game.currentTrick;
  const to = trick.grantedTo;
  const eleven = trick.playedCards.find((played) => played.username === winner.username);

  if (to === undefined || !eleven) {
    return;
  }

  const granted = to === null ? undefined : game.players.find((player) => player.username === to);
  let action: RoleAction;

  if (granted) {
    winner.tricksWon -= 1;
    granted.tricksWon += 1;
    addBonus(winner, "duke", -GRANT_POINTS);
    addBonus(granted, "duke", GRANT_POINTS);
    action = { role: "duke", by: winner.username, on: granted.username, card: eleven.card, points: -GRANT_POINTS };
  } else {
    addBonus(winner, "duke", KEEP_POINTS);
    action = { role: "duke", by: winner.username, on: winner.username, card: eleven.card, points: KEEP_POINTS };
  }

  trick.roleActions = [...(trick.roleActions ?? []), action];
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

    for (const { holder, points, blocked } of harvest(game.players, farmer.username, block)) {
      addRoundPoints(farmer, "farmer", points);
      addRoundPoints(holder, "farmer", -points);
      // A Smith's armour, one piece per seed, bounces points back.
      const bounced = Math.min(blocked * BLOCK_POINTS, Math.max(0, farmer.score));
      addRoundPoints(holder, "smith", bounced);
      addRoundPoints(farmer, "smith", -bounced);
    }
  }
}

// Points onto a score and into the last round's results, as this role's.
function addRoundPoints(player: GamePlayer, role: RoleId, points: number): void {
  const round = player.roundScores.at(-1);

  if (!points || !round) {
    return;
  }

  player.score += points;
  round.roleBonuses = { ...round.roleBonuses, [role]: (round.roleBonuses?.[role] ?? 0) + points };
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
  const caught = trick.playedCards[spot]!;

  // A Smith in armour keeps their card; the Fisher's turn is used all the same.
  if (armorOf(game)(caught.username)) {
    const action = blockedBy(caught.username, username, caught);
    trick.roleActions = [...(trick.roleActions ?? []), action];
    bounce(game, action);
    return;
  }

  trick.roleActions = [...(trick.roleActions ?? []), fish(trick.playedCards, username, spot)];
}

// A bot's or a quit player's catch, as the bots predict: wanted tricks first.
export function botFishingSpot(game: WizardGameState): number {
  const fisher = game.players[game.currentPlayerIndex];
  const wizardWins = normalizeGameOptions(game.options).wizardWins;
  const winsWith = (spot: number): boolean => {
    const copy: PlayedCard[] = game.currentTrick.playedCards.map((played) => ({ ...played }));

    fish(copy, fisher?.username ?? "", spot);

    return rules.determineTrickWinner(copy, game.trumpSuit, wizardWins, trickRolesIn(game)) === fisher?.username;
  };
  const wantsTricks = (fisher?.prediction ?? 0) > (fisher?.tricksWon ?? 0);
  // A Smith in armour would only block the catch.
  const spots = spotsToFish(game);
  const open = spots.filter((spot) => !armorOf(game)(game.currentTrick.playedCards[spot]!.username));

  return botCatch(open.length ? open : spots, winsWith, wantsTricks);
}

// A human whose time ran out: a card at random.
export const randomFishingSpot = (game: WizardGameState): number =>
  randomCatch(spotsToFish(game));
