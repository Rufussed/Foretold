import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { ANNOUNCER } from "../config";
import { paced, unhurried } from "../pace";
import { t } from "../../i18n";
import { createChimeSound } from "../chime-sound";
import type { GameConnection } from "../game-connection";
import { characterForPlayer, characterForUsername } from "../seat-mapping";
import { announcedName, eventMessages, playLogLines, roundResults, statusMessage, statusSubject } from "./announcements";
import { createGameWinner } from "./game-winner";
import { createResultsBoard, type ResultCard, type ResultsBoard } from "./round-results-board";
import type { HudPart } from "./hud-part";
import type { LogEntry } from "./event-log";

export interface Announcer extends HudPart {
  // Shows this straight away, ahead of anything queued, for
  // ANNOUNCER.noticeSeconds or until the next card is played.
  notice(text: string): void;
  // Shows this in turn with the queued announcements, for the usual time.
  // extraSeconds is added to that time whatever the game speed.
  // suit gives the border that suit's colour instead of a character's.
  announce(text: string, extraSeconds?: number, suit?: string): void;
  // Calls done once every one-off announcement (results included) has had
  // its time and none is queued; straight away if none is.
  whenIdle(done: () => void): void;
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
  // The player it's about: the border takes their character's colour.
  username?: string;
  seconds?: number; // defaults to ANNOUNCER.messageSeconds
  // Added after the pace scaling, so it is the same at every game speed.
  extraSeconds?: number;
  // The border takes this suit's colour (the trump colour announcement).
  suit?: string;
  // May show while cards are being dealt (last round's results).
  duringDeal?: boolean;
  // Also ends early as soon as the next card is played.
  untilNextPlay?: boolean;
  // A Roles power at work: never shorter than at the default pace.
  role?: boolean;
  // A power that hit you (loss) or paid you (gain): its own look, a chime
  // and ANNOUNCER.aboutYouExtraSeconds more.
  aboutYou?: "gain" | "loss";
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
  // While true, the standing "whose move" line stays hidden (the table
  // director shows it when the camera starts turning to that player).
  statusBlocked?(): boolean;
  // The table seat a player sits in, to shift a line about them toward their side.
  seatOf?(username: string): number | null;
  // The table's width on screen, in pixels, which the seat offsets are a share of.
  tableWidthPx?(): number;
  // An announcement that a player's prediction was changed (a Sabotage Seer
  // or Trickster) has just come up: the list swaps in the new number now (see
  // player-list.ts). byOther: another player's power changed it (a
  // Trickster); source: whose power it was.
  onPredictionChange?(username: string, byOther: boolean, source?: string): void;
  // What just happened, for the log (event-log.ts), as each snapshot comes
  // in: the cards played, then what the banners will say, in order.
  onLog?(round: number, entries: LogEntry[]): void;
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
  banner.innerHTML = `<p class="hud-announcer-tag" hidden></p><p class="hud-announcer-text"></p>`;
  root.append(banner);
  const textEl = banner.querySelector<HTMLElement>(".hud-announcer-text")!;
  // Over a power that hit or paid you: "Against you" or "For you".
  const tagEl = banner.querySelector<HTMLElement>(".hud-announcer-tag")!;
  let board: ResultsBoard | null = null;
  // Game over: the winner's portrait under the announcement.
  let winner: { dispose(): void } | null = null;

  const queue: Announcement[] = [];
  let showing = false;
  let timer = 0;
  let previous: PublicWizardGameState | null = null;
  let shown: Announcement | null = null;
  // While a notice waits for the next play: the play it was shown at.
  let shownAtPlay: string | null = null;
  let idleWaiters: Array<() => void> = [];
  const chime = createChimeSound();

  const flushIdleWaiters = () => {
    if (showing || queue.length) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((done) => done());
  };

  // Shifts the banner toward its player's side, but never so far that it runs
  // off the screen or within the edge padding. It may still lie over the HUD.
  let wantedOffset = 0;
  const placeBanner = () => {
    const room = (root.clientWidth - banner.offsetWidth) / 2 - ANNOUNCER.edgePaddingPx;
    const limit = Math.max(0, room);
    const offset = Math.max(-limit, Math.min(limit, wantedOffset));
    banner.style.setProperty("--announce-offset", `${offset.toFixed(1)}px`);
  };

  // The border's colour follows the character of the player an announcement is about.
  const setBorderCharacter = (username: string | undefined) => {
    const player = username ? game.state()?.players.find((candidate) => candidate.username === username) : undefined;
    const seat = username ? options.seatOf?.(username) : null;
    const percent = seat == null ? 0 : (ANNOUNCER.seatOffsetPercent[seat] ?? 0);
    wantedOffset = (percent / 100) * (options.tableWidthPx?.() ?? 0);
    placeBanner();
    if (username) banner.dataset.character = player ? characterForPlayer(player) : characterForUsername(username);
    else delete banner.dataset.character;
  };

  // The offset is a share of the table's width on screen, which a resize changes.
  const onResize = () => setBorderCharacter(shown?.username);
  window.addEventListener("resize", onResize);

  const show = (next: Announcement | null) => {
    if (!next?.text && !next?.results) return;
    const same = !next.results && !shown?.results && shown?.text === next.text;
    shown = next;
    banner.hidden = false;
    setBorderCharacter(next.username);
    if (next.suit) {
      delete banner.dataset.character;
      banner.dataset.suit = next.suit.toLowerCase();
    } else {
      delete banner.dataset.suit;
    }
    if (same) return;

    // Spring in again for each new announcement; reading offsetWidth restarts
    // the animation if the last one is still running.
    banner.classList.remove("is-popping");
    void banner.offsetWidth;
    banner.classList.add("is-popping");

    board?.dispose();
    board = null;
    winner?.dispose();
    winner = null;
    banner.classList.toggle("has-results", !!next.results);
    banner.classList.toggle("is-about-you", !!next.aboutYou);
    banner.classList.toggle("is-loss", next.aboutYou === "loss");
    tagEl.hidden = !next.aboutYou;
    tagEl.textContent = next.aboutYou ? t(next.aboutYou === "loss" ? "ann.againstYou" : "ann.forYou") : "";
    if (next.aboutYou) chime.play(next.aboutYou === "gain" ? "win" : "lose");
    // On phones the score panel shares the top of the screen, so the results
    // board goes just below it; elsewhere CSS keeps it at the top, beside it.
    const narrow = window.matchMedia("(max-width: 640px)").matches;
    const panel = next.results && narrow ? root.querySelector<HTMLElement>(".hud-status") : null;
    banner.style.top =
      panel && !panel.hidden
        ? `${Math.round(panel.getBoundingClientRect().bottom - root.getBoundingClientRect().top + 12)}px`
        : "";
    textEl.hidden = !!next.results;
    textEl.textContent = next.results ? "" : next.text;
    if (next.results) {
      board = createResultsBoard(banner, next.results, paced(ANNOUNCER.resultRevealSeconds), (card) =>
        scores.revealScore(card.username, card.points),
      );
    }
    // The content decides how wide the banner is, so place it now.
    placeBanner();
    const state = game.state();
    // A gold border for what's going on in a round, not for results or the end of the game.
    banner.classList.toggle("is-ingame", !next.results && state?.phase !== "finished");
    if (!next.results && state?.phase === "finished" && next.text === statusMessage(state, game.localUsername)) {
      winner = createGameWinner(banner, state);
    }
  };

  const hide = () => {
    banner.hidden = true;
    shown = null;
    board?.dispose();
    board = null;
    winner?.dispose();
    winner = null;
  };

  const showStatus = () => {
    if (options.blocked?.() || options.statusBlocked?.()) {
      hide();
      return;
    }
    const state = game.state();
    const text = state && statusMessage(state, game.localUsername);
    if (text) show({ text, username: (state && statusSubject(state)) ?? undefined });
  };

  const showNext = () => {
    // While dealing, only what may show during a deal goes next.
    const blocked = options.blocked?.() ?? false;
    const index = blocked ? queue.findIndex((item) => item.duringDeal) : queue.length ? 0 : -1;
    const next = index === -1 ? undefined : queue.splice(index, 1)[0];
    if (!next) {
      showing = false;
      showStatus();
      flushIdleWaiters();
      return;
    }
    showing = true;
    show(next);
    next.onShow?.();
    const state = game.state();
    shownAtPlay = next.untilNextPlay && state ? playKey(state) : null;
    // Every queued duration is written at the default pace, so scaling here
    // covers messages, notices and the round's results board together. A
    // role's power is never hurried, and one about you holds longer.
    const seconds = next.seconds ?? ANNOUNCER.messageSeconds;
    const extra = (next.extraSeconds ?? 0) + (next.aboutYou ? ANNOUNCER.aboutYouExtraSeconds : 0);
    timer = window.setTimeout(showNext, ((next.role ? unhurried(seconds) : paced(seconds)) + extra) * 1000);
  };

  return {
    applyState() {
      const state = game.state();
      if (!state) return;

      if (previous) {
        // The log: the cards played first, then each banner's words, the
        // trick won told with the winner's role and card.
        const plays = options.onLog ? playLogLines(previous, state) : [];
        const log: LogEntry[] = plays.filter((line) => !line.trick).map((line) => ({ text: line.text }));
        for (const { changes, byOther, source, trick, ...message } of eventMessages(previous, state, game.localUsername)) {
          const won = trick ? plays.find((line) => line.trick) : undefined;
          log.push(won ? { text: won.text, kind: "trick" } : { text: message.text, tone: message.aboutYou });
          queue.push(
            changes
              ? { ...message, onShow: () => options.onPredictionChange?.(changes, !!byOther, source) }
              : message,
          );
        }
        options.onLog?.(state.currentRound, log);

        const results = roundResults(previous, state);
        if (results.length) {
          // The table keeps last round's totals until each line is read.
          scores.holdScores(new Map(results.map((result) => [result.username, result.total - result.points])));
          // One board for the whole round, the best round's card first.
          const cards: ResultCard[] = results.map((result) => {
            const player = state.players.find((candidate) => candidate.username === result.username);
            return {
              username: result.username,
              name: announcedName(result.username),
              character: player ? characterForPlayer(player) : characterForUsername(result.username),
              summary: result.summary,
              lines: result.lines,
              points: result.points,
            };
          });
          // In the log, one line per player: how the points came about.
          const signed = (points: number) => (points >= 0 ? `+${points}` : String(points));
          const entries: LogEntry[] = results.map((result) => ({
            kind: "result",
            text: [
              `${announcedName(result.username)}: ${result.summary}`,
              ...result.lines.map((line) => `${line.label} ${line.value}`.trim()),
              `= ${signed(result.points)} (${result.total})`,
            ].join(" \u00b7 "),
          }));
          options.onLog?.(state.players[0]?.roundScores.length ?? state.currentRound, entries);
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

    announce(text, extraSeconds, suit) {
      const round = game.state()?.currentRound;
      if (round) options.onLog?.(round, [{ text }]);
      queue.push({ text, extraSeconds, suit });
      if (!showing) showNext();
    },

    notice(text) {
      window.clearTimeout(timer);
      queue.unshift({ text, username: game.localUsername, seconds: ANNOUNCER.noticeSeconds, untilNextPlay: true });
      showNext();
    },

    whenIdle(done) {
      idleWaiters.push(done);
      flushIdleWaiters();
    },

    dispose() {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      chime.dispose();
      idleWaiters = [];
      banner.remove();
    },
  };
}
