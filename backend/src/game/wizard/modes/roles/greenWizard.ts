import type { Card } from "../../models/card.js";
import { isJester, isWizard } from "../../models/card.js";

// The Green Wizard: every green card they hold counts 3 higher against other
// green cards: a 7 is a 10, a 12 a 15, beating even a 13. A boosted card that
// only draws level loses: a Green Wizard's 7 loses to a 10. Trumps and Wizards
// beat green as ever, and the boost belongs to the card's owner of the
// moment, so a green card a Thief takes loses it. The rules apply it through
// trickRoles.ts; its bonus is in colourWizards.ts.

export const GREEN_BOOST = 3;

export const isGreenCard = (card: Card): boolean => card.suit === "Green" && !isWizard(card) && !isJester(card);
