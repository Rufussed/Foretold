import { CARDS as CLASSIC_CARDS } from "../../visualizer/config";

// The look of a Sabotage game (Rufus's settings from the foretold branch).
// Classic and Roles tables keep src/visualizer/config.ts as it is; where a
// Sabotage table differs, its own values are here.

// ══════════════════════════════════════════════════════════════════════════
// CARDS  (element art with the number printed on in code)
// ══════════════════════════════════════════════════════════════════════════

export const CARDS = {
  ...CLASSIC_CARDS,

  // Colour for each suit, as CSS colours: its element's colour (see
  // elementColors), used for the trump chooser and the trump marker.
  suitColors: {
    Red: "#e92223",
    Green: "#4ca450",
    Blue: "#018bf6",
    Yellow: "#e2c98a",
  } as Record<string, string>,

  // The element each suit is drawn as: it names the card art's folder and
  // files (src/assets/sabotage-cards/fire/fire-7.webp). The rules still know
  // the suits by colour.
  suitElements: {
    Red: "fire",
    Green: "earth",
    Blue: "water",
    Yellow: "air",
  } as Record<string, string>,

  // Each element's colour, from its icon: the number on its cards is filled
  // with this.
  elementColors: {
    fire: "#e92223",
    earth: "#4ca450",
    water: "#018bf6",
    air: "#e2c98a",
  } as Record<string, string>,

  // Multiplied into an icon that is drawn white, so it matches its number;
  // the other icons already carry their colour.
  iconTints: {
    air: "#e2c98a",
  } as Record<string, string>,

  // The J and W on Jesters and Wizards, which belong to no suit.
  specialColor: "#f5c518",

  // Outline around the label, as a fraction of the label height.
  outlineWidth: 0.11,

  // How far the black outline fades out past its edge, as a fraction of the
  // label height. 0 is a hard edge.
  outlineFeather: 0.1,

  // Whether the print on a face is embossed at all; false prints it flat,
  // and the settings below wait unused.
  embossEnabled: false,

  // The emboss on everything printed on a face, lit from above: how far the
  // edges are shifted to make the rims, as a fraction of the face's width
  // (never under 1px), the alpha (0 to 255) from which the print counts as
  // solid when the rims are cut, then how strong the white rim along the top
  // edges and the dark rim along the bottom edges are, 0 to 1, and the dark
  // rim's colour.
  embossDepth: 0.004,
  embossThreshold: 128,
  embossLight: 0.9,
  embossShade: 0.85,
  embossShadeColor: "#2a2a2a",

  // The element icon under each number: its width as a fraction of the label
  // height (a tall icon is shrunk to fit the same height), the gap above it as
  // a fraction of the label height, and its black outline as a fraction of the
  // number's outline.
  iconSize: 0.704,
  iconGap: 0.3,
  iconOutline: 0.6,

  // Whether the number, symbol and icon are printed in both top corners, or only
  // in the top right.
  bothCorners: false,

  // The card's title across its middle: its size as a fraction of the card's
  // width (the numbers' size, 0.18, is a good match) and the widest share of
  // the card it may take before it is shrunk to fit.
  nameSize: 0.12,
  nameMaxWidth: 0.624,

  // How far below the card's middle the title sits, as a fraction of its
  // height; 0 is centred.
  nameDropFraction: 0.08,

  // The symbol on the Fool, Seer, Trickster and Wizard, in place of a letter:
  // the square it is fitted into, as a fraction of the label height. On a Seer
  // or Trickster it sits under the number and the element symbol, with the gap
  // below (badgeGap, or tricksterBadgeGap), as a fraction of the label height.
  symbolSize: 0.9,
  // How much larger a symbol is on a Fool or Wizard, which has no number.
  soloSymbolScale: 1.3,
  // And moved left by this much, as a fraction of the label height.
  soloSymbolShift: 0.12,
  // Extra scale for single symbols that read small beside the others.
  symbolScales: { seer: 1.1, fool: 1.1, thief: 1.15 } as Record<string, number>,
  badgeGap: 0.24,
  // The gap above the Trickster's mask, which has a flat top and needs less than
  // the Seer's round eye.
  tricksterBadgeGap: 0.13,
  // The Thief's mask, a little closer to the element icon than the others.
  thiefBadgeGap: 0.16,
  // fraction of the label height. 0 puts the outline's edge on the card's;
  // the mesh's corners are rounded to about 0.25 of the label height, so low
  // values can clip the corner of the first digit.
  labelMargin: 0,

  // Extra gap above the number, on top of labelMargin, as a fraction of the
  // label height: it moves the numbers and icons down without moving them in
  // from the sides.
  labelTopMargin: 0.3,
  // A number of two digits (10 to 13) is set this much of the size of the
  // others, with its top level with theirs.
  twoDigitScale: 0.8,
  // Then each is nudged by this many pixels (on a face 512 wide): single digits
  // a pixel smaller, two digit numbers a pixel bigger.
  oneDigitAdjustPx: -1,
  twoDigitAdjustPx: 1,

  // The card back's print, over the art's gold ring. Sizes are fractions of the
  // card's width; the ring's own place was measured off the art, whose circle
  // is centred on the card.
  back: {
    title: "Foretold",
    titleColor: "#d4af37",
    // The title's width, and the gap from its bottom to the top of the ring's
    // icon.
    titleWidth: 0.76,
    titleGap: 0.13,
    // Where the ring's centre sits down the card, as a fraction of its height:
    // the art's circle is moved down this far from the middle (29px of 716,
    // when the file was made), the space it leaves at the top left black.
    ringCenterY: 0.5405,
    // The ring's radius, measured to the middle of its line.
    ringRadius: 0.268,
    // Colours for the elements on the back, where they differ from the faces':
    // air is a darker cream here, so it stands apart from the white spirit.
    elementTints: { air: "#e2c98a" } as Record<string, string>,
    // What sits at each point of the pentagram, clockwise from the top: spirit
    // above, then water, fire, earth and air, the order of the pentacle.
    ringElements: ["spirit", "water", "fire", "earth", "air"],
    // The Wizard's symbol in the middle of the ring, in the special yellow: its
    // width as a fraction of the card's.
    centerSymbolSize: 0.204,
    // Icon size, and its black outline and feather, as for the corner icons.
    iconSize: 0.1296,
    iconOutline: 0.008,
    iconFeather: 0.012,
  },

  // Cards given a wash of their element's colour, listed by file name: all of
  // air's thirteen ranks, to warm the pale sky into the same dark cream as its
  // numbers and symbols, and the Fool, whose pale sky is too white too. The
  // Wizards are left as drawn.
  // `tintStrength` is how much of the colour shows, 0 to 1.
  tintedCards: [
    ...Array.from({ length: 13 }, (_, i) => `air-${i + 1}`),
    "air-jester",
    "earth-jester",
    "fire-jester",
    "water-jester",
  ],
  // The Fool's wash, the same dark cream as air's, on all four of them.
  foolTint: "#e2c98a",
  tintStrength: 0.3,

  // Handled-card wear: a vignette of this colour creeping in from the edges,
  // broken up by noise. `width` is how far it reaches, `roughness` how far the
  // noise pulls that edge in and out, and `grain` how speckled it is, all as
  // fractions of the card width; `strength` is how opaque it gets at the very
  // edge, 0 for none.
  wear: {
    color: "#e8dcb8",
    width: 0.054,
    roughness: 0.03,
    grain: 0.35,
    strength: 0.65,
    // A thin darker line on the very edge, over the wear: the colour, how thick
    // it is as a fraction of the card's width, how opaque at the edge itself
    // (0 for none), and how much the noise breaks it up, 0 to 1.
    rim: { color: "#3b2e1a", width: 0.01, strength: 0.6, grain: 0.4 },
    // The radius of the card's rounded corners, as a fraction of its width,
    // measured off the card mesh in Wizard.glb so the wear follows the shape.
    cornerRadius: 0.0513,
  },
};

// ══════════════════════════════════════════════════════════════════════════
// SABOTAGE THIEF  (winning a trick with it swaps a card with another player's;
// not the Roles mode's Thief)
// ══════════════════════════════════════════════════════════════════════════
export const SABOTAGE_THIEF = {
  // The target's fan, shown to the winner: it rises to sit over their own
  // fan, this many card lengths above it, in this many seconds.
  fanLiftLengths: 1.7,
  // And this much higher again, in metres, so the cards to choose from are clear
  // of your own fan.
  fanExtraMetres: 0.75,
  fanSeconds: 1.1,
  // The fan comes up to its final height first, in the first share of that
  // time, then moves across to the winner; going home it moves across first
  // and then drops.
  fanRiseShare: 0.4,

  // The two cards trading places: how long they take, how high they rise
  // along the way, in card lengths, and how far each passes to its side of the
  // other (your own card to your left), in card widths.
  swapSeconds: 3,
  swapArcLengths: 1.0,
  swapPassWidths: 0.3,
  // The shares of that time for each leg, the drop taking what is left: up out
  // of its hand, turning flat, travelling flat, turning to face its way.
  swapLegs: [0.2, 0.12, 0.3, 0.12] as const,

  // The camera's turn to the target and back, in seconds at the normal pace.
  cameraSeconds: 2,
};
