import type { Suit } from "../../../backend/src/game/wizard/models/card";
import { cardFile } from "./deck/card-art-files";
import { CARDS } from "./sabotage-config";

// The trump colours of a Sabotage table: each suit in its element's colour
// (the trump chooser, the trump marker).
export const sabotageTrumpColor = (suit: string): string | undefined => CARDS.suitColors[suit];

// The trump chooser's swatch for a suit: its element's icon on a dark card,
// ringed in the element's colour (see .is-sabotage .trump-swatch).
export function sabotageTrumpSwatch(swatch: HTMLElement, suit: Suit): void {
  swatch.style.borderColor = CARDS.suitColors[suit] ?? "";
  const icon = document.createElement("img");
  icon.src = cardFile(`icons/${CARDS.suitElements[suit]}.webp`);
  icon.alt = "";
  swatch.append(icon);
}
