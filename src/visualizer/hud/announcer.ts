import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { ANNOUNCER } from "../config";
import type { GameConnection } from "../game-connection";
import { characterForPlayer, characterForUsername } from "../seat-mapping";
import { eventMessages, roundResults, statusMessage } from "./announcements";
import { createResultsBoard, type ResultCard, type ResultsBoard } from "./round-results-board";
import type { HudPart } from "./hud-part";

export interface Announcer extends HudPart {
  // Shows this straight away, ahead of anything queued, for
  // ANNOUNCER.noticeSeconds or until the next card is played.
  notice(text: string): void;
}

// How the announcer holds back the score table while round results are read out.
export interface ScoreBoard {
  // Show these totals instead of the real ones until each is revealed.
  holdScores(totals: ReadonlyMap<string, number>): void;
  // Show a player's real total, flashing green for points gained or red for lost.
  revealScore(username: string, points: number): void;
}

interface Announcement {
  text: string;
  // A round's results, shown as a board of cards instead of the text.
  results?: ResultCard[];
  seconds?: number; // defaults to ANNOUNCER.messageSeconds
  // May show while cards are being dealt (last round's results).
  duringDeal?: boolean;
  // Also ends early as soon as the next card is played.
  untilNextPlay?: boolean;
  onShow?: () => void;
}

// Changes whenever a card is played, a trick is won or a round begins.
const playKey = (state: PublicWizardGameState) =>
  `${state.currentRound}:${state.currentTrick.playedCards.length}:${state.currentTrick.winnerUsername ?? ""}`;

// Top centre: what's going on. One-off events (a prediction, a won trick) each
// show for ANNOUNCER.messageSeconds, in order; a round's results show as a board
// of cards (see round-results-board.ts); between them, whose move it is.
export interface AnnouncerOptions {
  // While true (cards being dealt), only last round's results show; everything
  // else waits until the deal has landed, trump card included.
  blocked?(): boolean;
}

export function createAnnouncer(
  root: HTMLElement,
  game: GameConnection,
  scores: ScoreBoard,
  options: AnnouncerOptions = {},
): Announcer {
  const banner = document.createElement("div");
  banner.className = "hud-announcer";
  banner.setAttribute("role", "status");
  banner.hidden = true;
  banner.innerHTML = `<p class="hud-announcer-text"></p>`;
  root.append(banner);
  const textEl = banner.querySelector<HTMLElement>(".hud-announcer-text")!;
  let board: ResultsBoard | null = null;

  const queue: Announcement[] = [];
  let showing = false;
  let timer = 0;
  let previous: PublicWizardGameState | null = null;
  let shown: Announcement | null = null;
  // While a notice waits for the next play: the play it was shown at.
  let shownAtPlay: string | null = null;

  const show = (next: Announcement | null) => {
    if (!next?.text && !next?.results) return;
    const same = !next.results && !shown?.results && shown?.text === next.text;
    shown = next;
    banner.hidden = false;
    if (same) return;

    board?.dispose();
    board = null;
    banner.classList.toggle("has-results", !!next.results);
    textEl.hidden = !!next.results;
    textEl.textContent = next.results ? "" : next.text;
    if (next.results) {
      board = createResultsBoard(banner, next.results, ANNOUNCER.resultRevealSeconds, (card) =>
        scores.revealScore(card.username, card.points),
      );
    }
    // Restart the fade-in for each new line.
    banner.classList.remove("is-new");
    void banner.offsetWidth;
    banner.classList.add("is-new");
  };

  const hide = () => {
    banner.hidden = true;
    shown = null;
    board?.dispose();
    board = null;
  };

  const showStatus = () => {
    if (options.blocked?.()) {
      hide();
      return;
    }
    const state = game.state();
    const text = state && statusMessage(state, game.localUsername);
    if (text) show({ text });
  };

  const showNext = () => {
    // While dealing, only what may show during a deal goes next.
    const blocked = options.blocked?.() ?? false;
    const index = blocked ? queue.findIndex((item) => item.duringDeal) : queue.length ? 0 : -1;
    const next = index === -1 ? undefined : queue.splice(index, 1)[0];
    if (!next) {
      showing = false;
      showStatus();
      return;
    }
    showing = true;
    show(next);
    next.onShow?.();
    const state = game.state();
    shownAtPlay = next.untilNextPlay && state ? playKey(state) : null;
    timer = window.setTimeout(showNext, (next.seconds ?? ANNOUNCER.messageSeconds) * 1000);
  };

  return {
    applyState() {
      const state = game.state();
      if (!state) return;

      if (previous) {
        for (const text of eventMessages(previous, state, game.localUsername)) queue.push({ text });

        const results = roundResults(previous, state, game.localUsername);
        if (results.length) {
          // The table keeps last round's totals until each line is read.
          scores.holdScores(new Map(results.map((result) => [result.username, result.total - result.points])));
          // One board for the whole round, cards appearing lowest points first.
          const cards: ResultCard[] = results.map((result) => {
            const player = state.players.find((candidate) => candidate.username === result.username);
            return {
              username: result.username,
              name: result.username,
              character: player ? characterForPlayer(player) : characterForUsername(result.username),
              text: result.text,
              points: result.points,
            };
          });
          queue.push({
            text: "",
            results: cards,
            // The first card shows at once; the hold starts when the last appears.
            seconds: (cards.length - 1) * ANNOUNCER.resultRevealSeconds + ANNOUNCER.resultHoldSeconds,
            duringDeal: true,
          });
        }
      }
      previous = state;

      // A notice waiting for the next play ends once it happens.
      if (shownAtPlay !== null && playKey(state) !== shownAtPlay) {
        shownAtPlay = null;
        window.clearTimeout(timer);
        showNext();
        return;
      }

      if (!showing) {
        if (queue.length) showNext();
        else showStatus();
      }
    },

    notice(text) {
      window.clearTimeout(timer);
      queue.unshift({ text, seconds: ANNOUNCER.noticeSeconds, untilNextPlay: true });
      showNext();
    },

    dispose() {
      window.clearTimeout(timer);
      banner.remove();
    },
  };
}
