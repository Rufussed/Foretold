import { normalizeGameOptions } from "../gameOptions.js";
import type { Card } from "../models/card.js";
import type { PlayedCard, WizardGameState } from "../models/wizardGame.js";
import { powerOn, swapLastTwo } from "../modes/roles/rolePlay.js";
import { rolesOf } from "../modes/roles/rolePowers.js";
import { roleCard, type RoleId } from "../modes/roles/roles.js";
import { findService } from "../modes/roles/servant.js";
import { findSteal } from "../modes/roles/thief.js";
import { currentPlayer } from "./personality.js";

// How a bot sees its own role in a Roles game (modes/roles/): what its role's
// card is worth in a bid, and what playing a card would do to the trick. In
// a Classic game a bot has no role, and every card is just a card.

export interface Play {
  card: Card;
  index: number;
}

// Roughly the tricks a role's card brings in a bid. The Fisher picks the
// winner when played early, the Thief often steals one, the Servant's luck
// depends on the next player, and the Farmer's 4 farms points, not tricks.
const BID_VALUE: Record<RoleId, number> = { thief: 0.5, servant: 0.3, fisher: 0.6, farmer: 0 };

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
// it sets off at once: its own Thief's steal, or a Servant just before it
// receiving the card.
export function trickAfter(game: WizardGameState, card: Card): PlayedCard[] {
  const { username } = currentPlayer(game);
  const trick = game.currentTrick.playedCards.map((played) => ({ ...played }));

  trick.push({ username, playedBy: username, card });
  if (isRoles(game)) {
    const roleOf = rolesOf(game);

    if (findService(trick, game.trumpSuit, roleOf) ?? findSteal(trick, game.trumpSuit, roleOf)) {
      swapLastTwo(trick);
    }
  }

  return trick;
}

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

const isFarmerFour = (game: WizardGameState, card: Card): boolean =>
  roleOfBot(game) === "farmer" && isRoleCard(game, card);

// The card the bot's role would rather play now, if any. Wanting tricks: a
// Fisher's 3 with cards still to come, as it can fish the best of them; or,
// with nothing that wins, a Servant's 2 as a gamble on the next card. Not
// wanting them: a Farmer's 4 that loses, so a seed goes to someone else.
export function rolePick(
  game: WizardGameState,
  legal: Play[],
  losers: Play[],
  wantsTricks: boolean,
  hasWinner: boolean,
): Play | undefined {
  if (!wantsTricks) {
    return losers.find(({ card }) => isFarmerFour(game, card));
  }

  return legal.find(({ card }) => powerAhead(game, card, "fisher"))
    ?? (hasWinner ? undefined : legal.find(({ card }) => servesNext(game, card)));
}
