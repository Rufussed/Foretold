import { t } from "../../i18n";

// One line of the log: what a banner said, in the order the table showed it.
export interface LogEntry {
  text: string;
  // A power that brought you points (gain) or cost you (loss).
  tone?: "gain" | "loss";
  // A trick won closes a trick; a round's result is one player's line.
  kind?: "trick" | "result";
}

export interface EventLog {
  // Adds these lines under the round they happened in.
  add(round: number, entries: LogEntry[]): void;
  dispose(): void;
}

// Most lines kept, enough for a whole game; the oldest go first.
const MAX_ENTRIES = 3000;

// In a Roles game, a Log button just above the player list (bottom left)
// opens a panel over it with what has happened this game, round by round:
// every card played, with its player's role and whether its power is on, role
// powers and their points, every trick won and with what, and each round's
// results with the role points in them. For checking what happened, and that
// the points came right.
export function createEventLog(page: HTMLElement): EventLog {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-log-toggle";
  button.textContent = t("game.log");
  button.setAttribute("aria-expanded", "false");
  page.append(button);

  const panel = document.createElement("section");
  panel.className = "event-log";
  panel.setAttribute("aria-label", t("game.log"));
  panel.hidden = true;
  panel.innerHTML = `<p class="event-log-empty">${t("game.logEmpty")}</p><ol class="event-log-list"></ol>`;
  page.append(panel);
  const list = panel.querySelector<HTMLOListElement>(".event-log-list")!;
  const empty = panel.querySelector<HTMLElement>(".event-log-empty")!;
  let lastRound: number | null = null;

  // Stays at the newest line unless you have scrolled up to read.
  const atBottom = () => panel.scrollHeight - panel.scrollTop - panel.clientHeight < 24;

  // The button sits just above the player list, headings included, and the
  // panel above the button; the list grows and shrinks with the round.
  const place = () => {
    const players = page.querySelector<HTMLElement>(".hud-opponents");
    const pageBox = page.getBoundingClientRect();
    let top = pageBox.bottom - 16;
    if (players && !players.hidden) {
      for (const element of [players, ...players.querySelectorAll<HTMLElement>(".hud-stat-label")]) {
        const box = element.getBoundingClientRect();
        if (box.height) top = Math.min(top, box.top);
      }
    }
    const bottom = pageBox.bottom - top + 8;
    button.style.bottom = `${Math.round(bottom)}px`;
    panel.style.bottom = `${Math.round(bottom + button.offsetHeight + 8)}px`;
  };
  let frame = 0;
  const track = () => {
    place();
    frame = requestAnimationFrame(track);
  };
  track();

  const toggle = () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) panel.scrollTop = panel.scrollHeight;
  };
  button.addEventListener("click", toggle);

  return {
    add(round, entries) {
      if (!entries.length) return;
      const follow = atBottom();
      if (round !== lastRound) {
        lastRound = round;
        const heading = document.createElement("li");
        heading.className = "event-log-round";
        heading.textContent = t("game.logRound", { round: String(round) });
        list.append(heading);
      }
      for (const entry of entries) {
        const line = document.createElement("li");
        line.className = "event-log-line";
        if (entry.tone) line.classList.add(`is-${entry.tone}`);
        if (entry.kind) line.classList.add(`is-${entry.kind}`);
        line.textContent = entry.text;
        list.append(line);
      }
      while (list.children.length > MAX_ENTRIES) list.firstElementChild?.remove();
      empty.hidden = true;
      if (follow) panel.scrollTop = panel.scrollHeight;
    },

    dispose() {
      cancelAnimationFrame(frame);
      button.removeEventListener("click", toggle);
      button.remove();
      panel.remove();
    },
  };
}
