import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import type { CharacterId } from "../character-assets";
import { ANNOUNCER } from "../config";
import type { GameConnection } from "../game-connection";
import { characterForPlayer } from "../seat-mapping";
import { eventMessages, roundResults, statusMessage } from "./announcements";
import { headshotUrl } from "./headshots";
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
  // A player's headshot and name, shown beside the text (round results).
  portrait?: { name: string; character: CharacterId };
  seconds?: number; // defaults to ANNOUNCER.messageSeconds
  // Also ends early as soon as the next card is played.
  untilNextPlay?: boolean;
  onShow?: () => void;
}

// Changes whenever a card is played, a trick is won or a round begins.
const playKey = (state: PublicWizardGameState) =>
  `${state.currentRound}:${state.currentTrick.playedCards.length}:${state.currentTrick.winnerUsername ?? ""}`;

// Top centre: what's going on. One-off events (a prediction, a won hand, round
// results) each show for ANNOUNCER.messageSeconds, round results for
// resultSeconds, in order; between them the banner says whose move it is.
export function createAnnouncer(root: HTMLElement, game: GameConnection, scores: ScoreBoard): Announcer {
  const banner = document.createElement("div");
  banner.className = "hud-announcer";
  banner.setAttribute("role", "status");
  banner.hidden = true;
  banner.innerHTML = `
    <figure class="hud-opponent-face hud-announcer-face" hidden>
      <img alt="" />
      <figcaption></figcaption>
    </figure>
    <p class="hud-announcer-text"></p>
  `;
  root.append(banner);
  const face = banner.querySelector<HTMLElement>(".hud-announcer-face")!;
  const faceImage = face.querySelector("img")!;
  const faceName = face.querySelector("figcaption")!;
  const textEl = banner.querySelector<HTMLElement>(".hud-announcer-text")!;

  const queue: Announcement[] = [];
  let showing = false;
  let timer = 0;
  let previous: PublicWizardGameState | null = null;
  let shown: Announcement | null = null;
  // While a notice waits for the next play: the play it was shown at.
  let shownAtPlay: string | null = null;

  const show = (next: Announcement | null) => {
    if (!next?.text) return;
    const same = shown?.text === next.text && shown?.portrait?.name === next.portrait?.name;
    shown = next;
    banner.hidden = false;
    if (same) return;

    textEl.textContent = next.text;
    face.hidden = !next.portrait;
    banner.classList.toggle("has-portrait", !!next.portrait);
    if (next.portrait) {
      faceName.textContent = next.portrait.name;
      faceImage.removeAttribute("src");
      const wanted = next;
      headshotUrl(next.portrait.character)
        .then((url) => {
          if (shown === wanted) faceImage.src = url;
        })
        .catch((error) => console.warn("[announcer] no headshot:", error));
    }
    // Restart the fade-in for each new line.
    banner.classList.remove("is-new");
    void banner.offsetWidth;
    banner.classList.add("is-new");
  };

  const showStatus = () => {
    const state = game.state();
    const text = state && statusMessage(state, game.localUsername);
    if (text) show({ text });
  };

  const showNext = () => {
    const next = queue.shift();
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
          for (const result of results) {
            const player = state.players.find((candidate) => candidate.username === result.username);
            queue.push({
              text: result.text,
              portrait: player ? { name: player.username, character: characterForPlayer(player) } : undefined,
              seconds: ANNOUNCER.resultSeconds,
              onShow: () => scores.revealScore(result.username, result.points),
            });
          }
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
