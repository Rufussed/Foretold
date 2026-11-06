import { isJester, type Card } from "../../../models/card.js";
import type { GamePlayer, WizardGameState } from "../../../models/wizardGame.js";
import { WizardRules } from "../../../services/wizardRules.js";
import { playerOf } from "../rolePlay.js";
import { masterRoleOf } from "../roles.js";

// The Joker, a master role with no card of its own: with a Joker point, not
// bound to follow suit. Holding the suit led, even trump, the Joker may spend
// a point to play any card - a trump, or any other suit to throw it away. Who
// wins the trick is decided as ever: a card of another suit, not a trump,
// cannot win. Roles mode only.
//
// Points are earned by winning tricks: every JOKER_TRICKS tricks won, in a row
// or not, across rounds, give a point, up to JOKER_MAX. A trick won while the
// Joker holds the most points, or one in which they spent a point, does not
// count towards the next. A trick a Duke grants them counts as theirs, and
// so does playing a Jester, whoever wins.

export const JOKER_TRICKS = 3;
export const JOKER_MAX = 3;

const rules = new WizardRules();

// Whether this player may play any card now: a Joker with a point to spend.
export const playsFree = (player: Pick<GamePlayer, "role" | "masterRole" | "jokerPoints"> | undefined): boolean =>
  !!player && masterRoleOf(player) === "joker" && (player.jokerPoints ?? 0) > 0;

// Whether this card, played now, uses the Joker's power: a card the rules
// would refuse, because the hand holds the suit led and this is not of it.
export const breaksSuit = (card: Card, hand: Card[], leadSuit: Card["suit"] | null): boolean =>
  !rules.isValidCardPlay(card, hand, leadSuit);

// The point spent as the Joker breaks suit.
export function spendJokerPoint(joker: GamePlayer): void {
  joker.jokerPoints = Math.max(0, (joker.jokerPoints ?? 0) - 1);
}

// Steps towards the next point, one at a time; none once full.
function addJokerSteps(joker: GamePlayer, steps: number): void {
  for (let step = 0; step < steps && (joker.jokerPoints ?? 0) < JOKER_MAX; step += 1) {
    const tricks = (joker.jokerTricks ?? 0) + 1;
    if (tricks < JOKER_TRICKS) {
      joker.jokerTricks = tricks;
    } else {
      joker.jokerTricks = 0;
      joker.jokerPoints = (joker.jokerPoints ?? 0) + 1;
    }
  }
}

// Once a trick is settled: a step for the Joker it counts for, unless they
// spent a point in it, and a step for every Joker who played a Jester in it,
// as if they had won it, whoever did. A Joker who wins with their own Jester
// gets both.
export function countJokerTrick(game: WizardGameState, owner: GamePlayer): void {
  const playedCards = game.currentTrick.playedCards;
  for (const joker of game.players.filter((player) => masterRoleOf(player) === "joker")) {
    const own = playedCards.filter((played) => playerOf(played) === joker.username);
    const spent = own.some((played) => played.freePlay);
    const won = joker === owner && !spent ? 1 : 0;
    const jesters = own.filter((played) => isJester(played.card)).length;
    addJokerSteps(joker, won + jesters);
  }
}
