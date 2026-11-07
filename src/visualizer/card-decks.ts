import type { Card } from "../../backend/src/game/wizard/models/card";
import { isGameMode, type GameMode } from "../../backend/src/game/wizard/modes/modes";
import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";

// The card decks. All the card art is one pool (src/assets/card-pool/, one
// picture per card per element); a deck is a list saying, for each number, the
// card's title and which picture it uses. The number and the title are printed
// on in code, so two decks can put the same picture under different numbers
// and names. The decks are written up in source-images/card-decks.md.
//
//   Deck A, Classic and Expanded: Rufus's names and numbers.
//   Deck B, Roleplay: Carlos's, which the Roles mode's powers are tied to.
//
// The Fool (value 0) and the Wizard (14) are the same in both.

export interface CardDeck {
  // The picture of a numbered card (1 to 13), named for its file in the pool:
  // src/assets/card-pool/<element>/<element>-<picture>.webp.
  picture(value: number): string;
  // The title's translation key for a numbered card (see i18n); the element
  // is the one the card is drawn as, for the titles that differ by it.
  titleKey(value: number, element: string): TitleKey;
  // Whether the Fool, Thief, Trickster, Seer and Wizard carry their symbol:
  // only on an Expanded table.
  symbols: boolean;
  // Without the symbols: whether the Wizard still carries a "W" and the
  // Jester its hat, as the old cards did (Classic and Roleplay).
  markSpecials?: boolean;
  // Without the symbols: the Wizard wears its Expanded symbol instead of the "W" (Classic).
  wizardSymbol?: boolean;
}

type TitleKey =
  | `sabotage.rank.${number}`
  | `roleplay.rank.${number}`
  | "cardtitle.king"
  | "cardtitle.queen"
  | "cardtitle.heiress"
  | "cardtitle.priestess"
  | "roleplay.duke"
  | "roleplay.duchess"
  | "roleplay.shepherdess";

// Some pictures are titled by the element they are drawn as, as the artwork is
// (source-images/foretoldv2/manifest.json): the feminine title for the elements
// listed, the masculine one for the rest. A picture not here keeps its
// deck's own title for its number.
const BY_ELEMENT: Record<string, { feminine: string[]; feminineKey: TitleKey; masculineKey?: TitleKey }> = {
  priest: { feminine: ["water", "earth"], feminineKey: "cardtitle.priestess" },
  heir: { feminine: ["fire", "air"], feminineKey: "cardtitle.heiress" },
  monarch: { feminine: ["fire", "air"], feminineKey: "cardtitle.queen", masculineKey: "cardtitle.king" },
  shepherd: { feminine: ["water", "earth"], feminineKey: "roleplay.shepherdess" },
  noble: { feminine: ["air", "fire"], feminineKey: "roleplay.duchess", masculineKey: "roleplay.duke" },
};

const titled = (
  pictures: readonly string[],
  fallback: (value: number) => TitleKey,
): CardDeck["titleKey"] => (value, element) => {
  const rule = BY_ELEMENT[pictures[value - 1]];
  if (!rule) return fallback(value);
  return rule.feminine.includes(element) ? rule.feminineKey : (rule.masculineKey ?? fallback(value));
};

const DECK_A_PICTURES = [
  "peasant",
  "farmer",
  "citizen",
  "soldier",
  "merchant",
  "priest",
  "general",
  "thief",
  "trickster",
  "seer",
  "heir",
  "consort",
  "monarch",
] as const;

// Roleplay's thirteen ranks, 1 to 13: the Prophet wears the Seer's picture and
// the King the Monarch's; the Thief is the Roleplay Thief, not Deck A's.
const DECK_B_PICTURES = [
  "rp-thief",
  "servant",
  "fisher",
  "farmer",
  "shepherd",
  "smith",
  "merchant",
  "priest",
  "warrior",
  "gambler",
  "noble",
  "seer",
  "monarch",
] as const;

// Classic, without the other symbols, marks its Jester (hat) and gives its Wizard the Expanded symbol.
const deckA = (symbols: boolean): CardDeck => ({
  picture: (value) => DECK_A_PICTURES[value - 1],
  titleKey: titled(DECK_A_PICTURES, (value) => `sabotage.rank.${value}`),
  symbols,
  markSpecials: !symbols,
  wizardSymbol: !symbols,
});

const DECKS: Record<GameMode, CardDeck> = {
  classic: deckA(false),
  sabotage: deckA(true),
  roles: {
    picture: (value) => DECK_B_PICTURES[value - 1],
    titleKey: titled(DECK_B_PICTURES, (value) => `roleplay.rank.${value}`),
    symbols: false,
    // The Wizard's "W" and the Jester's hat (sabotage-card-loader.ts).
    markSpecials: true,
  },
};

// The picture a card uses, as its file's name in the pool: "fool" and "wizard"
// for the two outside the ranks.
export const pictureOf = (deck: CardDeck, card: Card): string =>
  card.value === 0 ? "fool" : card.value === 14 ? "wizard" : deck.picture(card.value);

// The deck of the game on the table. Set from the game's first state, before
// the scene is built (pages/Visualizer.ts), and cleared when the page is left.
let mode: GameMode = "classic";

export function setCardDeckMode(state: Pick<PublicWizardGameState, "options"> | null): void {
  const wanted = state?.options?.mode;
  mode = isGameMode(wanted) ? wanted : "classic";
}


export const activeDeck = (): CardDeck => DECKS[mode];
