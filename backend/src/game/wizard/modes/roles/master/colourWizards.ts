import type { Card, Suit } from "../../../models/card.js";
import { isJester, isWizard } from "../../../models/card.js";
import { WizardRules, type TrickRoles } from "../../../services/wizardRules.js";
import type { GamePlayer, TrickState } from "../../../models/wizardGame.js";
import { masterRoleOf, type RoleId } from "../roles.js";
import { isGreenCard } from "./greenWizard.js";

// The colour Wizards: roles with no card of their own, one for each colour
// whose Wizard they are. Their powers:
//   Blue Wizard    sees how many blue cards each hidden hand holds (blueWizard.ts)
//   Green Wizard   their green cards count 3 higher (greenWizard.ts)
//   Yellow Wizard  with no card of the lead suit, a yellow card above the
//                  lead card makes yellow the lead suit (wizardRules.getLeadSuit)
//   Red Wizard     a red card of theirs on a red lead means no trumps count
//                  in that trick, for anyone, and no Yellow Wizard can turn
//                  the lead after it (wizardRules.redShield)
// Each also earns points for a trick won with the Wizard of their colour: the
// Blue and Red Wizards 10 more than the others.

const rules = new WizardRules();

export const COLOUR_WIZARDS = {
  blueWizard: { suit: "Blue", bonus: 20 },
  greenWizard: { suit: "Green", bonus: 10 },
  yellowWizard: { suit: "Yellow", bonus: 10 },
  redWizard: { suit: "Red", bonus: 20 },
} as const satisfies Partial<Record<RoleId, { suit: Suit; bonus: number }>>;

export type ColourWizardId = keyof typeof COLOUR_WIZARDS;

export const isColourWizard = (role: RoleId | null | undefined): role is ColourWizardId =>
  !!role && role in COLOUR_WIZARDS;

// The Red Wizard's burn (shown as the Power of Fire): when a higher red card
// than theirs wins a trick they shielded, its winner loses these points, to
// no one, never more than they have.
export const FIRE_BURN = 5;

// Whether this trick burns its winner: the Red Wizard's shield is up and
// someone without that power won it with a red card. A Wizard that wins burns
// no one.
export function burnsWinner(
  trick: TrickState,
  trumpSuit: Suit | null,
  roles: TrickRoles | undefined,
  winner: { username: string; role?: RoleId | null; masterRole?: RoleId | null },
): boolean {
  if (!rules.redShield(trick.playedCards, trumpSuit, roles) || masterRoleOf(winner) === "redWizard") return false;
  const winning = trick.playedCards.find((played) => played.username === winner.username);
  return !!winning && winning.card.suit === "Red" && !isWizard(winning.card) && !isJester(winning.card);
}

// Whether this card is the Wizard of this colour Wizard's colour.
export const isOwnWizardCard = (role: ColourWizardId, card: Card): boolean =>
  isWizard(card) && card.suit === COLOUR_WIZARDS[role].suit;

// The bonus the trick's winner earns, from the house: a colour Wizard who won
// it with the Wizard of their colour, whoever played it first; the Green
// Wizard with any green card too.
export function colourWizardBonus(trick: TrickState, winner: GamePlayer): number {
  const role = masterRoleOf(winner);
  if (!isColourWizard(role)) return 0;
  const winning = trick.playedCards.find((played) => played.username === winner.username);
  if (!winning) return 0;
  const earns = isOwnWizardCard(role, winning.card) || (role === "greenWizard" && isGreenCard(winning.card));
  return earns ? COLOUR_WIZARDS[role].bonus : 0;
}
