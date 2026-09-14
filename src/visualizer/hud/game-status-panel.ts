import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { trumpColor } from "../card-textures";
import type { GameConnection } from "../game-connection";
import type { ScoreBoard } from "./announcer";
import type { HudPart } from "./hud-part";

export type GameStatusPanel = HudPart & ScoreBoard;

// Top right: the whole game at a glance. Which round, what's happening now,
// the trump suit, and everyone's total score.
export function createGameStatusPanel(root: HTMLElement, game: GameConnection): GameStatusPanel {
  const panel = document.createElement("section");
  panel.className = "hud-panel hud-status";
  panel.setAttribute("aria-label", "Game status");
  panel.hidden = true;
  panel.innerHTML = `
    <p class="hud-round"></p>
    <p class="hud-phase"></p>
    <p class="hud-trump"><span class="hud-trump-swatch"></span><span class="hud-trump-name"></span></p>
    <table class="hud-scores">
      <thead><tr><th scope="col">Player</th><th scope="col">Score</th></tr></thead>
      <tbody></tbody>
    </table>
  `;
  root.append(panel);

  const roundEl = panel.querySelector<HTMLElement>(".hud-round")!;
  const phaseEl = panel.querySelector<HTMLElement>(".hud-phase")!;
  const swatchEl = panel.querySelector<HTMLElement>(".hud-trump-swatch")!;
  const trumpEl = panel.querySelector<HTMLElement>(".hud-trump-name")!;
  const scoresEl = panel.querySelector<HTMLTableSectionElement>("tbody")!;

  // Totals held back while round results are announced, and one row per player
  // kept across updates so a score's flash isn't cut short.
  const held = new Map<string, number>();
  const rows = new Map<string, { row: HTMLTableRowElement; name: HTMLElement; score: HTMLElement }>();
  let order = "";

  const nameOf = (username: string) => (username === game.localUsername ? "You" : username);

  const describePhase = (state: PublicWizardGameState): string => {
    const current = state.players[state.currentPlayerIndex]?.username ?? "";
    const whose = current === game.localUsername ? "your turn" : `${current}'s turn`;
    switch (state.phase) {
      case "trump-selection":
        return current === game.localUsername ? "Choose the trump suit" : `${current} is choosing trump`;
      case "predictions":
        return `Bidding · ${whose}`;
      case "playing":
        return state.currentTrick.winnerUsername
          ? `${nameOf(state.currentTrick.winnerUsername)} won the trick`
          : `Playing · ${whose}`;
      case "finished": {
        const leader = [...state.players].sort((a, b) => b.score - a.score)[0];
        return leader ? `Game over · ${nameOf(leader.username)} won` : "Game over";
      }
    }
  };

  const describeTrump = (state: PublicWizardGameState): { text: string; color: string | null } => {
    if (!state.trumpCard) return { text: "No trump", color: null };
    if (state.trumpSuit) return { text: `Trump: ${state.trumpSuit}`, color: trumpColor(state.trumpSuit) };
    if (state.trumpCard.value === 14 || state.trumpCard.value === 0) return { text: "Trump: to be chosen", color: null };
    return { text: "No trump", color: null };
  };

  const applyState = () => {
    const state = game.state();
    if (!state) {
      panel.hidden = true;
      return;
    }

    roundEl.textContent = `Round ${state.currentRound} of ${state.totalRounds}`;
    phaseEl.textContent = describePhase(state);

    const trump = describeTrump(state);
    trumpEl.textContent = trump.text;
    swatchEl.hidden = !trump.color;
    if (trump.color) swatchEl.style.background = trump.color;

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
      entry.row.classList.toggle("is-you", player.username === game.localUsername);
      entry.name.textContent = nameOf(player.username);
      entry.score.textContent = String(shown(player));
    }
    // Moving a row restarts its flash, so rows only move when the order changes.
    const nextOrder = ranked.map((player) => player.username).join("\n");
    if (nextOrder !== order) {
      order = nextOrder;
      scoresEl.replaceChildren(...ranked.map((player) => rows.get(player.username)!.row));
    }

    panel.hidden = false;
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
