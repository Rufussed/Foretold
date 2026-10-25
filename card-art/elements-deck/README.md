# Elements deck (Rufus's card art)

The card pictures from Rufus's `foretold` branch (as of commit `5425451`),
copied here as source art. They are **not used by the game**: nothing in
`src/` loads this folder, and it is not part of the build. The game shows the
gem cards in `src/assets/foretold_cards/`.

On Rufus's branch the pictures carry **no numbers or text**. His game paints
the number, icons, symbols, title, a wash of colour and a worn edge onto each
picture as it loads, and paints a title and icons onto the back. This file
lists everything that is painted on, so it can be added to the pictures
themselves (for example in GIMP, in another folder) and the finished cards can
then be used like the gem cards, with nothing drawn in code.

## What is here

| Folder | Files | Size (px) |
|---|---|---|
| `fire/`, `earth/`, `water/`, `air/` | `<element>-1.webp` … `-13`, `-jester`, `-wizard` (15 each) | 512 × 716 |
| `back/` | `back-plain.webp`, the back before its print | 512 × 716 |
| `icons/` | `fire`, `earth`, `water`, `air`: the element icons | 160 wide |
| `symbols/` | `fool`, `wizard`, `seer`, `trickster`, `spirit` | 192 × 192 |

512 × 716 is the same shape as the gem cards (350 × 490), just larger.

The four `-jester` files are one painting, shared; the game tints them.

## Suits and colours

The game rules still name the suits by colour. On these cards:

| Rules | Element | Colour of its number and title |
|---|---|---|
| Red | Fire | `#e92223` |
| Green | Earth | `#4ca450` |
| Blue | Water | `#018bf6` |
| Yellow | Air | `#e2c98a` (a dark cream) |
| (no suit) | Fool, Wizard, and the Seer/Trickster symbols | `#f5c518` (yellow) |

## Fonts

Both are free Google Fonts (Open Font License):

- **Uncial Antiqua** (regular): the numbers and the word "Foretold" on the back.
- **Merienda**, bold (700): the titles across the middle of the cards.

## Every face

Measurements below are for the 512 × 716 pictures. "N" is the number's font
size: **92 px** (18% of the card's width).

### 1. Number (top right corner only)

- Ranks 1 to 13, in the element's colour, in Uncial Antiqua at 92 px.
- **Black outline** 10 px thick (about 11% of N; half of it falls inside the
  letters), softened by a black glow of about 9 px around it.
- All numbers share one centre line: the middle of where "00" would sit,
  flush against the right edge (the outline touching the edge). "7" and "13"
  are centred on the same line, so their icons line up.
- Top: about 28 px of extra space above the number (30% of N).
- The Fool and Wizard have **no number**.

### 2. Element icon (under the number)

- The element's icon from `icons/`, fitted into a 74 px square (80% of N),
  centred under the number, 28 px below it (30% of N).
- Black outline about 3 px, with the same soft glow.
- The air icon is white in the file and is tinted `#e2c98a` when printed;
  the other three already have their colour.
- The Fool and Wizard have **no element icon**.

### 3. Symbol (only on the Fool, Wizard, Seer and Trickster)

- From `symbols/`, drawn white in the file and tinted yellow `#f5c518`, with
  the same black outline.
- **Seer (8):** the eye, about 91 px (83 px × 1.1), under the element icon,
  about 22 px below it.
- **Trickster (7):** the mask, 83 px, under the element icon, about 5 px below
  it (its flat top needs less gap).
- **Fool:** the jester's hat, about 119 px (larger, as it stands alone), at the
  top of the corner where the number would be.
- **Wizard:** the pentagram, about 108 px, alone in the corner like the Fool.
- Note: the Seer and Trickster symbols belong to Rufus's game mode with card
  powers (see `game-modes/foretold-mode.md`). In classic play the 7 and 8
  have no power, so a classic version of the deck would leave these two
  symbols off.

### 4. Title (across the middle)

- Merienda bold, 61 px (12% of the card's width), shrunk to fit if it would be
  wider than 319 px (62.4% of the width).
- Centred left to right; its middle sits at 58% of the height (about 415 px
  down), a little below the centre.
- Black outline and soft glow like the numbers.
- Colour: the element's colour, except the Fool, Wizard, Seer and Trickster,
  whose titles are yellow `#f5c518`.

| Value | English | German |
|---|---|---|
| 1 | Peasant | Bauer |
| 2 | Farmer | Landwirt |
| 3 | Citizen | Bürger |
| 4 | Soldier | Soldat |
| 5 | Merchant | Händler |
| 6 | Priest | Priester |
| 7 | Trickster | Trickser |
| 8 | Seer | Seher |
| 9 | Noble | Adel |
| 10 | General | General |
| 11 | Heir | Erbe |
| 12 | Consort | Konsort |
| 13 | Monarch | Monarch |
| Jester | Fool | Narr |
| Wizard | Wizard | Zauberer |

The game shows the title in the player's language. Pictures can only carry
one language, so pick one (or leave the titles off). Rufus marks the German
titles as a first draft.

In classic play, 7 and 8 have no power, so "Trickster" and "Seer" may want
neutral titles in a classic version.

### 5. Colour wash (only some cards)

- All 13 air cards and all four Fools get a 30% wash of `#e2c98a`, using the
  **Color** blend (hue and saturation only, the light and dark stay). In GIMP:
  a layer filled with `#e2c98a`, mode **HSL Color**, opacity 30%.
- Every other card is left as painted.

### 6. Worn edge (every face)

- **Cream vignette** `#e8dcb8` creeping in from the edges, about 28 px wide
  (5.4% of the width), 65% opaque at the very edge and fading inwards. Its
  inner edge is broken up with noise (wobbles about 15 px) and speckled.
- **Dark rim** `#3b2e1a`, about 5 px wide on the very edge, 60% opaque,
  slightly broken up.
- Both follow **rounded corners** of radius about 26 px, the shape of the 3D
  card. The corners outside that radius are never seen in the game.
- The wear is random per card (seeded by the card), so no two are the same.

Order on Rufus's cards: picture, slight sharpening, colour wash, wear, then
the number, icon, symbol and title on top.

## The back

Painted onto `back/back-plain.webp`:

- **"Foretold"** in Uncial Antiqua, gold `#d4af37`, 389 px wide (76% of the
  width), centred, above the ring, with a gap of about 67 px to the top icon.
- The gold ring in the picture has its centre at 54% of the height (387 px
  down) and a radius of 137 px (26.8% of the width), measured to the middle
  of its line.
- Five icons on the ring, at the points of a pentagram, clockwise from the top:
  **spirit** (`symbols/spirit.webp`, white), **water**, **fire**, **earth**,
  **air**. Each about 66 px (13% of the width), with a thin black outline
  (about 4 px) and glow (about 6 px). Air is tinted `#e2c98a`.
- The **Wizard's pentagram** (`symbols/wizard.webp`) in the centre of the ring,
  yellow `#f5c518`, about 104 px wide (20.4% of the width).

## Using finished cards in the game

Save them as WebP, one file per card, named like the gem sets
(`<set>01.webp` … `<set>13.webp`, `<set>Jester.webp`, `<set>Wizard.webp`) in a
new folder under `src/assets/foretold_cards/`, and add the set to
`FORETOLD_GEMS` in `src/visualizer/card-texture-loader.ts`. A back goes in
`src/assets/foretold_cards/back/` and is picked with `FORETOLD_BACK` there.
The game reads any size; 350 × 490 matches the gem cards and keeps the
download small.
