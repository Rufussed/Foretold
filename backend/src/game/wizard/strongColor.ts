// A player's strong colour: one of the four suits, given at random when they
// sign up and never changed by them. Every trick they win with a card of that
// colour (not a Wizard or Jester, and not a card the server played for them)
// brings colour points, added to their stats when the game ends. Shared by the
// server and the Study, so like gameOptions.ts it must stay free of Node-only
// code, because Vite bundles it into the browser.
//
// Later, reaching COLOR_MASTERY_POINTS will master the colour and give the
// player the next one, at random; the skills that come with it are for other
// game modes, never Wizard Classic.
import { SUITS, type Suit } from "./models/card.js";

export const COLOR_POINTS_PER_TRICK = 10;
export const COLOR_MASTERY_POINTS = 1000;

export const isSuit = (value: unknown): value is Suit =>
  SUITS.some((suit) => suit === value);

// SQL for a random colour, so the database can deal one to many players at once.
export const RANDOM_COLOR_SQL = `
  CASE ABS(RANDOM()) % 4
    WHEN 0 THEN 'Blue'
    WHEN 1 THEN 'Red'
    WHEN 2 THEN 'Yellow'
    ELSE 'Green'
  END
`;
