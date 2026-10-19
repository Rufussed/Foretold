// Where the card art lives: src/assets/cards, one file per card, the back, and
// the element icons.

// Vite copies each file into the build with a hash of its contents in its name,
// so re-scanned art reaches players as a new URL their cache cannot mistake for
// the old one. The hash is only known at build time, so a card's path can no
// longer be assembled from its suit and value: that naming still decides which
// file is wanted, but the URL itself comes from this table. Keys are the glob
// patterns exactly as written above.
const CARD_FILES = import.meta.glob("../assets/cards/**/*.webp", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function cardFile(path: string): string {
  const url = CARD_FILES[`../assets/cards/${path}`];
  // A missing file is a mistake in the naming below or a card that was never
  // scanned; say so rather than handing three.js undefined and drawing a blank.
  if (!url) throw new Error(`No card art at ${path}`);
  return url;
}
