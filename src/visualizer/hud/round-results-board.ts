import type { CharacterId } from "../character-assets";
import { headshotUrl } from "./headshots";

export interface ResultCard {
  username: string;
  name: string; // shown under the headshot
  character: CharacterId;
  text: string; // the result lines, "\n" between them
  points: number;
}

export interface ResultsBoard {
  dispose(): void;
}

// A round's results as a grid of equal cards, one per player, three to a row:
// headshot and name, the result lines beside. Cards appear in the order given
// (lowest points first), one every revealSeconds; onReveal fires as each shows.
export function createResultsBoard(
  container: HTMLElement,
  cards: readonly ResultCard[],
  revealSeconds: number,
  onReveal: (card: ResultCard) => void,
): ResultsBoard {
  const grid = document.createElement("div");
  grid.className = "hud-results";
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

    const text = document.createElement("p");
    text.className = "hud-result-text";
    text.textContent = card.text;

    element.append(face, text);
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
