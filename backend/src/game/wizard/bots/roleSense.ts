import { normalizeGameOptions } from "../gameOptions.js";
import type { Card } from "../models/card.js";
import type { PlayedCard, WizardGameState } from "../models/wizardGame.js";
import { powerOn } from "../modes/roles/rolePlay.js";
import { armorOf, playPower, rolesOf } from "../modes/roles/rolePowers.js";
import { roleCard, type RoleId } from "../modes/roles/roles.js";
import { trickRolesIn } from "../modes/roles/master/trickRoles.js";
import { trades } from "../modes/roles/merchant.js";
import { canBet } from "../modes/roles/gambler.js";
import { canLower } from "../modes/roles/prophet.js";
import { sheepOut } from "../modes/roles/shepherd.js";
import { stealSpots } from "../modes/roles/thief.js";
import { WizardRules } from "../services/wizardRules.js";
import { currentPlayer } from "./personality.js";

const rules = new WizardRules();

// How a bot sees its own role in a Roles game (modes/roles/): what its role's
// card is worth in a bid, and what playing a card would do to the trick. In
// a Classic game a bot has no role, and every card is just a card.

export interface Play {
  card: Card;
  index: number;
}

// Roughly the tricks a role's card brings in a bid. The Fisher picks the
// winner when played early, the Thief often steals one, the Servant's luck
// depends on the next player, the Farmer's 4 and the Shepherd's 5 bring
// points, not tricks, the Smith's 6 forges armour, the Merchant's 7
// trades, the Priest's 8 collects faith from royal cards, and the Warrior's 9
// wins or loses a battle.
const BID_VALUE: Record<RoleId, number> = {
  thief: 0.5, servant: 0.3, fisher: 0.6, farmer: 0, shepherd: 0, smith: 0, merchant: 0, priest: 0, warrior: 0, gambler: 0, duke: 0, prophet: 0, king: 0,
  // No card of its own; its sight is used in blueWizardSense.ts.
  blueWizard: 0,
  // No card either; its boost is in every trick it plays (master/greenWizard.ts).
  greenWizard: 0,
  yellowWizard: 0,
  redWizard: 0,
  // No card: the Joker plays any card it likes (master/joker.ts).
  joker: 0,
  // No card: the Watcher only sees (master/watcher.ts).
  watcher: 0,
};

const isRoles = (game: WizardGameState): boolean =>
  normalizeGameOptions(game.options).mode === "roles";

// The role of the bot whose turn it is, in a Roles game.
export const roleOfBot = (game: WizardGameState): RoleId | undefined =>
  isRoles(game) ? currentPlayer(game).role : undefined;

// Whether this card is the bot's role card, in whatever suit.
export function isRoleCard(game: WizardGameState, card: Card): boolean {
  const role = roleOfBot(game);

  return role !== undefined && card.value === roleCard(role);
}

export const roleBidValue = (game: WizardGameState, card: Card): number =>
  isRoleCard(game, card) ? BID_VALUE[roleOfBot(game)!] : 0;

// The trick as it would stand once the bot plays this card, with the powers
// it sets off at once: its own Thief's steal, of the card at stealSpot, or a
// Servant just before it receiving the card.
function trickWith(game: WizardGameState, card: Card, stealSpot?: number): PlayedCard[] {
  const { username } = currentPlayer(game);
  const trick = game.currentTrick.playedCards.map((played) => ({ ...played }));

  trick.push({ username, playedBy: username, card });
  if (isRoles(game)) {
    playPower(trick, game.trumpSuit, rolesOf(game), stealSpot, armorOf(game));
  }

  return trick;
}

// Which card a Thief bot's trump 1 takes, when it has a choice: one that wins
// it the trick when it wants tricks, one that loses it when it has enough;
// the nearest such card. Undefined when there is nothing to choose.
export function stealChoice(game: WizardGameState, card: Card): number | undefined {
  const player = currentPlayer(game);
  const played: PlayedCard = { username: player.username, playedBy: player.username, card };
  const spots = stealSpots([...game.currentTrick.playedCards, played], game.trumpSuit, rolesOf(game));

  if (spots.length < 2) {
    return undefined;
  }

  const wizardWins = normalizeGameOptions(game.options).wizardWins;
  const wantsTricks = (player.prediction ?? 0) > player.tricksWon;
  const wins = (spot: number) =>
    rules.determineTrickWinner(trickWith(game, card, spot), game.trumpSuit, wizardWins, trickRolesIn(game)) ===
    player.username;

  return [...spots].reverse().find((spot) => wins(spot) === wantsTricks);
}

// Whether a Gambler bot bets on its 10: only when the 10 can carry a bet and
// would be winning the trick once played, and then only with no one left to
// play, or as a trump with one player left. A careful player, not a reckless
// one.
export function betChoice(game: WizardGameState, card: Card): boolean {
  const player = currentPlayer(game);
  if (roleOfBot(game) !== "gambler" || card.value !== roleCard("gambler")) return false;

  const trick = trickAfter(game, card);
  if (!canBet(trick, game.currentTrick.playedCards.length, game.trumpSuit, rolesOf(game))) return false;

  const wizardWins = normalizeGameOptions(game.options).wizardWins;
  const winning = rules.determineTrickWinner(trick, game.trumpSuit, wizardWins, trickRolesIn(game)) === player.username;
  const left = game.players.length - trick.length;
  // A won bet pays 25 against 10 lost, so a fair chance is worth the bet.
  return winning && (left === 0 || card.suit === game.trumpSuit || left <= 1);
}

// Whether a Prophet bot lowers its prediction with its 12: when the tricks
// it still needs are more than it can see itself winning - this 12 if it
// is winning the trick so far, and every Wizard, trump 11 or higher and other
// 13 left in its hand. A 12 is strong, so it keeps the prediction otherwise
// and plays for the bonus.
export function lowerChoice(game: WizardGameState, card: Card): boolean {
  const player = currentPlayer(game);
  if (roleOfBot(game) !== "prophet" || card.value !== roleCard("prophet")) return false;

  const trick = trickAfter(game, card);
  if (!canLower(trick, game.currentTrick.playedCards.length, game.trumpSuit, rolesOf(game), player)) return false;

  const wizardWins = normalizeGameOptions(game.options).wizardWins;
  const winning = rules.determineTrickWinner(trick, game.trumpSuit, wizardWins, trickRolesIn(game)) === player.username;
  const strong = player.hand.filter((held) =>
    held !== card && (held.value === 14 || held.value === 13 || (held.suit === game.trumpSuit && held.value >= 11))).length;
  const needs = (player.prediction ?? 0) - player.tricksWon;

  return (winning ? 1 : 0) + strong < needs;
}

export const trickAfter = (game: WizardGameState, card: Card): PlayedCard[] =>
  trickWith(game, card, stealChoice(game, card));

// Whether this card would be the bot's role card with its power on, with
// players still to come after it.
function powerAhead(game: WizardGameState, card: Card, role: RoleId): boolean {
  const trick = trickAfter(game, card);
  const last = trick.length - 1;

  return roleOfBot(game) === role
    && last < game.players.length - 1
    && powerOn(trick, last, role, game.trumpSuit, rolesOf(game));
}

// A Servant's 2 takes whatever comes next: risky when it wants to lose.
export const servesNext = (game: WizardGameState, card: Card): boolean =>
  powerAhead(game, card, "servant");

// A Farmer's 4 or a Shepherd's 5: a seed or a sheep for whoever wins.
const givesAway = (game: WizardGameState, card: Card): boolean =>
  (roleOfBot(game) === "farmer" || roleOfBot(game) === "shepherd") && isRoleCard(game, card);

// A Smith's 6 with its power on: a piece of armour.
function forgesNow(game: WizardGameState, card: Card): boolean {
  const trick = trickAfter(game, card);

  return roleOfBot(game) === "smith" && powerOn(trick, trick.length - 1, "smith", game.trumpSuit, rolesOf(game));
}

// A Merchant's 7 as the trick's last card, with its power on and a market
// that pays: more cards it beats than cards that beat it.
function profitableMarket(game: WizardGameState, card: Card): boolean {
  const trick = trickAfter(game, card);
  const last = trick.length - 1;

  if (roleOfBot(game) !== "merchant" || last < game.players.length - 1
    || !powerOn(trick, last, "merchant", game.trumpSuit, rolesOf(game))) {
    return false;
  }

  const market = trades(trick, currentPlayer(game).username, game.trumpSuit);

  return market.filter((trade) => trade.sells).length > market.filter((trade) => !trade.sells).length;
}

// A Shepherd is paid only by winning with their own 5: once sheep are out,
// the 5 that takes the trick so far. The more sheep are out, the more it
// risks: as the last card with one, from one before last with two, from two
// before last with three.
function collectingFive(game: WizardGameState, winners: Play[]): Play | undefined {
  const { username } = currentPlayer(game);
  const stillToCome = game.players.length - 1 - game.currentTrick.playedCards.length;

  if (roleOfBot(game) !== "shepherd" || stillToCome >= sheepOut(game.players, username)) {
    return undefined;
  }

  return winners.find(({ card }) => isRoleCard(game, card));
}

// The card the bot's role would rather play now, if any. Wanting tricks: a
// Shepherd's 5 that wins so far, early enough for the sheep out; a
// Fisher's 3 with cards still to come, as it can fish the best of them; or,
// with nothing that wins, a Servant's 2 as a gamble on the next card. Not
// wanting them: a Farmer's 4 or a Shepherd's 5 that loses, so a seed or a
// sheep goes to someone else, or a Smith's 6 that loses and forges armour.
// Either way, a Merchant's 7 that closes the trick with a market that pays,
// when it wins or loses as wanted.
export function rolePick(
  game: WizardGameState,
  legal: Play[],
  winners: Play[],
  losers: Play[],
  wantsTricks: boolean,
): Play | undefined {
  const trading = (wantsTricks ? winners : losers).find(({ card }) => profitableMarket(game, card));

  if (!wantsTricks) {
    return trading ?? losers.find(({ card }) => givesAway(game, card) || forgesNow(game, card));
  }

  return trading
    ?? collectingFive(game, winners)
    ?? legal.find(({ card }) => powerAhead(game, card, "fisher"))
    ?? (winners.length ? undefined : legal.find(({ card }) => servesNext(game, card)));
}
