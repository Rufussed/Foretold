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
// Each also earns 10 points for a trick won with the Wizard of their colour
// (the Green Wizard with any green card too), the Blue Wizard 20: the Red one
// has its burn, the Yellow and Green ones win tricks with their power.

const rules = new WizardRules();

export const COLOUR_WIZARDS = {
  blueWizard: { suit: "Blue", bonus: 20 },
  greenWizard: { suit: "Green", bonus: 10 },
  yellowWizard: { suit: "Yellow", bonus: 10 },
  redWizard: { suit: "Red", bonus: 10 },
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

// The Green Wizard's bonus for a trick won with a green number card; the
// green Wizard pays the full bonus, as the others' Wizards do.
export const GREEN_CARD_BONUS = 5;

// The bonus the trick's winner earns, from the house: a colour Wizard who won
// it with the Wizard of their colour, whoever played it first; the Green
// Wizard GREEN_CARD_BONUS with any green card.
export function colourWizardBonus(trick: TrickState, winner: GamePlayer): number {
  const role = masterRoleOf(winner);
  if (!isColourWizard(role)) return 0;
  const winning = trick.playedCards.find((played) => played.username === winner.username);
  if (!winning) return 0;
  if (isOwnWizardCard(role, winning.card)) return COLOUR_WIZARDS[role].bonus;
  return role === "greenWizard" && isGreenCard(winning.card) ? GREEN_CARD_BONUS : 0;
}

// The Yellow Wizard's take (shown as the Power of Air): turning the lead takes
// these points from the player who led, never more than they have.
export const AIR_TAKE = 5;

// Who turned this trick's lead to yellow, and who had led it; null when no
// one did.
export function airSwitch(
  trick: TrickState,
  trumpSuit: Suit | null,
  roles: TrickRoles | undefined,
): { by: string; from: string } | null {
  const plays = trick.playedCards;
  const lead = plays.find((played) => !isJester(played.card));
  if (!lead || isWizard(lead.card) || lead.card.suit === "Yellow") return null;
  for (let index = 1; index < plays.length; index++) {
    const before = rules.getLeadSuit(plays.slice(0, index), trumpSuit, roles);
    const after = rules.getLeadSuit(plays.slice(0, index + 1), trumpSuit, roles);
    if (before !== "Yellow" && after === "Yellow") {
      const turned = plays[index]!;
      return { by: turned.playedBy ?? turned.username, from: lead.playedBy ?? lead.username };
    }
  }
  return null;
}
