import type { Card, Suit } from "../../../models/card.js";
import { WizardRules } from "../../../services/wizardRules.js";
import type { RoleId } from "../roles.js";

// The Joker, a master role with no card of its own: never bound to follow
// suit. Holding the suit led, the Joker may still play any card - a trump,
// or any other suit to throw it away. Who wins the trick is decided as ever:
// a card of another suit, not a trump, cannot win. Roles mode only.

const rules = new WizardRules();

// Whether a player of this role may play any card at any time.
export const playsFree = (role: RoleId | null | undefined): boolean => role === "joker";

// Whether this card, played now, uses the Joker's power: a card the rules
// would refuse, because the hand holds the suit led and this is not of it.
export const breaksSuit = (card: Card, hand: Card[], leadSuit: Suit | null): boolean =>
  !rules.isValidCardPlay(card, hand, leadSuit);
