import type { CharacterId } from "../character-assets";
import type { RoundResultLine } from "./announcements";
import { headshotUrl } from "./headshots";

export interface ResultCard {
  username: string;
  name: string; // shown under the headshot
  character: CharacterId;
  summary: string; // "Predicted 2 · Won 2"
  lines: RoundResultLine[]; // how the points came about

  points: number;
}

export interface ResultsBoard {
  dispose(): void;
}

// A round's results as equal cards, one per player, up to three to a row and
// centred: headshot and name, the result lines below. A single best score is
// highlighted with a crown; a tie for best highlights no one. Cards appear in
// the order given (best round first), one every revealSeconds; onReveal fires
// as each shows.
//
// Every card is built and placed at the start, then each is made visible in
// turn. The row is centred and wraps, so appending them one at a time moved the
// cards already up: each new arrival re-centred the row under the reader. They
// hold their final places from the first reveal instead.
export function createResultsBoard(
  container: HTMLElement,
  cards: readonly ResultCard[],
  revealSeconds: number,
  onReveal: (card: ResultCard) => void,
): ResultsBoard {
  const grid = document.createElement("div");
  grid.className = "hud-results";
  container.append(grid);
  // The round's winner: only a single best score counts, a tie has none.
  const best = Math.max(...cards.map((card) => card.points));
  const winner = cards.filter((card) => card.points === best).length === 1 ? best : null;

  const timers: number[] = [];
  let disposed = false;

  const build = (card: ResultCard) => {
    const element = document.createElement("div");
    element.className = "hud-result";
    // The winner's crown takes the character's colour.
    element.dataset.character = card.character;
    element.classList.toggle("is-winner", card.points === winner);

    const face = document.createElement("figure");
    face.className = "hud-opponent-face hud-result-face";
    const image = document.createElement("img");
    image.alt = "";
    const name = document.createElement("figcaption");
    name.textContent = card.name;
    face.append(image, name);

    const summary = document.createElement("p");
    summary.className = "hud-result-summary";
    summary.textContent = card.summary;

    // How the points came about: a bonus and tricks in green, or how far off.
    const lines = document.createElement("p");
    lines.className = "hud-result-lines";
    for (const line of card.lines) {
      const part = document.createElement("span");
      part.append(`${line.label} `);
      if (line.value) {
        const value = document.createElement("b");
        value.textContent = line.value;
        // A gain in green, a loss in red, "+0" as it is.
        value.dataset.sign = line.value.startsWith("-") ? "negative" : line.value === "+0" ? "zero" : "positive";
        part.append(value);
      }
      lines.append(part);
    }

    // The round's points as one number, green for a gain and red for a loss.
    const total = document.createElement("p");
    total.className = "hud-result-total";
    const signed = card.points >= 0 ? `+${card.points}` : String(card.points);
    total.textContent = signed;
    total.dataset.sign = card.points < 0 ? "negative" : card.points === 0 ? "zero" : "positive";

    element.append(face, summary, lines, total);
    headshotUrl(card.character)
      .then((url) => {
        if (!disposed) image.src = url;
      })
      .catch((error) => console.warn("[results] no headshot:", error));
    return element;
  };

  // Built and in place up front, holding their space while still hidden.
  const elements = cards.map((card) => {
    const element = build(card);
    element.classList.add("is-unrevealed");
    grid.append(element);
    return element;
  });

  cards.forEach((card, index) => {
    timers.push(
      window.setTimeout(() => {
        if (disposed) return;
        elements[index]?.classList.remove("is-unrevealed");
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
