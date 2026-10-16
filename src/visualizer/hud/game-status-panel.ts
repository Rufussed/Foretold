import { displayName } from "../../utils/display-name";
import type { GameConnection } from "../game-connection";
import type { ScoreBoard } from "./announcer";
import type { HudPart } from "./hud-part";

export type GameStatusPanel = HudPart & ScoreBoard;

// Top right: the whole game at a glance. Which round, and everyone's total
// score. What's happening now is the banner's job; the trump card shows trumps.
export function createGameStatusPanel(root: HTMLElement, game: GameConnection): GameStatusPanel {
  const panel = document.createElement("section");
  panel.className = "hud-panel hud-status";
  panel.setAttribute("aria-label", "Game status");
  panel.hidden = true;
  panel.innerHTML = `
    <p class="hud-round"></p>
    <table class="hud-scores">
      <thead>
        <tr>
          <th>Player</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  root.append(panel);

  const roundEl = panel.querySelector<HTMLElement>(".hud-round")!;
  const scoresEl = panel.querySelector<HTMLTableSectionElement>("tbody")!;

  // Totals held back while round results are announced, and one row per player
  // kept across updates so a score's flash isn't cut short.
  const held = new Map<string, number>();
  const rows = new Map<
    string,
    {
      row: HTMLTableRowElement;
      name: HTMLElement;
      score: HTMLElement;
    }
  >();
  let order = "";

  // const nameOf = (username: string) => (username === game.localUsername ? "You" : username);
  const nameOf = (username: string) => displayName(username);
  // A name too long for its column is cut at the last letter that fits and
  // ends in a dash. Done by measuring rather than by CSS ellipsis, which
  // takes a wider mark and gives up more letters than it needs to.
  const fitName = (cell: HTMLElement, full: string) => {
    cell.textContent = full;
    if (!cell.clientWidth || cell.scrollWidth <= cell.clientWidth) return;
    // A bot's " NPC" goes before any letters of its name do: "Merlin", not
    // "Merlin NP-".
    const bare = full.replace(/ NPC$/, "");
    if (bare !== full) {
      cell.textContent = bare;
      if (cell.scrollWidth <= cell.clientWidth) return;
      full = bare;
    }
    for (let length = full.length - 1; length > 0; length--) {
      cell.textContent = `${full.slice(0, length).trimEnd()}-`;
      if (cell.scrollWidth <= cell.clientWidth) return;
    }
  };

  const applyState = () => {
    const state = game.state();
    if (!state) {
      panel.hidden = true;
      return;
    }

    roundEl.textContent = `Round ${state.currentRound} of ${state.totalRounds}`;


    const shown = (player: { username: string; score: number }) => held.get(player.username) ?? player.score;
    const ranked = [...state.players].sort(
      (a, b) => shown(b) - shown(a) || a.username.localeCompare(b.username),
    );
    for (const player of ranked) {
      let entry = rows.get(player.username);
      if (!entry) {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        const score = document.createElement("td");
        row.append(name, score);
        entry = { row, name, score };
        rows.set(player.username, entry);
      }
      entry.row.classList.toggle(
        "is-you",
        player.username === state.players[state.currentPlayerIndex]?.username,
      );
      entry.name.textContent = nameOf(player.username);
      entry.name.dataset.full = nameOf(player.username);
      entry.score.textContent = String(shown(player));
    }
    // Moving a row restarts its flash, so rows only move when the order changes.
    const nextOrder = ranked.map((player) => player.username).join("\n");
    if (nextOrder !== order) {
      order = nextOrder;
      scoresEl.replaceChildren(...ranked.map((player) => rows.get(player.username)!.row));
    }

    panel.hidden = false;
    // Measured once the rows are in place and the panel is showing.
    for (const { name } of rows.values()) fitName(name, name.dataset.full ?? "");
  };

  return {
    applyState,

    holdScores(totals) {
      held.clear();
      for (const [username, total] of totals) held.set(username, total);
      applyState();
    },

    revealScore(username, points) {
      held.delete(username);
      applyState();
      const score = rows.get(username)?.score;
      if (!score) return;
      score.classList.remove("is-gain", "is-loss");
      void score.offsetWidth; // restart the flash
      score.classList.add(points >= 0 ? "is-gain" : "is-loss");
    },

    dispose() {
      panel.remove();
    },
  };
}
