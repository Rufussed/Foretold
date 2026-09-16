import type { CharacterId } from "../character-assets";
import type { RoundResultLine } from "./announcements";
import { headshotUrl } from "./headshots";

export interface ResultCard {
  username: string;
  name: string; // shown under the headshot
  character: CharacterId;
  lines: RoundResultLine[]; // label and signed value per line
  points: number;
}

export interface ResultsBoard {
  dispose(): void;
}

// A round's results as a grid of equal cards, one per player, three to a row:
// headshot and name, the result lines beside. Cards appear in the order given
// (best round first), one every revealSeconds; onReveal fires as each shows.
export function createResultsBoard(
  container: HTMLElement,
  cards: readonly ResultCard[],
  revealSeconds: number,
  onReveal: (card: ResultCard) => void,
): ResultsBoard {
  const grid = document.createElement("div");
  grid.className = "hud-results";
  grid.style.setProperty("--columns", String(Math.max(1, Math.min(3, cards.length))));
  container.append(grid);

  const timers: number[] = [];
  let disposed = false;

  const build = (card: ResultCard) => {
    const element = document.createElement("div");
    element.className = "hud-result";

    const face = document.createElement("figure");
    face.className = "hud-opponent-face hud-result-face";
    const image = document.createElement("img");
    image.alt = "";
    const name = document.createElement("figcaption");
    name.textContent = card.name;
    face.append(image, name);

    // Labels on the left, values in a column of their own so the signs align.
    const lines = document.createElement("dl");
    lines.className = "hud-result-lines";
    for (const line of card.lines) {
      const label = document.createElement("dt");
      label.textContent = line.label;
      const value = document.createElement("dd");
      value.textContent = line.value;
      lines.append(label, value);
    }

    element.append(face, lines);
    headshotUrl(card.character)
      .then((url) => {
        if (!disposed) image.src = url;
      })
      .catch((error) => console.warn("[results] no headshot:", error));
    return element;
  };

  cards.forEach((card, index) => {
    timers.push(
      window.setTimeout(() => {
        if (disposed) return;
        grid.append(build(card));
        onReveal(card);
      }, index * revealSeconds * 1000),
    );
  });

  return {
    dispose() {
      disposed = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      grid.remove();
    },
  };
}
