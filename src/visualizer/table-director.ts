import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { OPPONENT_PLAYS, TRICK_REWARD } from "./config";
import { paced } from "./pace";

export interface TableDirector {
  // What the card table shows now.
  tableState(): PublicWizardGameState | null;
  // What the HUD and prompts show now.
  hudState(): PublicWizardGameState | null;
  // True once the current move's player has been announced (status line and
  // camera turn): prompts may open, the status line may show.
  turnShown(): boolean;
  // A new snapshot from the server.
  push(state: PublicWizardGameState): void;
  // The card table has finished dealing.
  dealt(): void;
  dispose(): void;
}

export interface TableDirectorOptions {
  initial: PublicWizardGameState | null;
  localUsername: string;
  // Redraw the card table / the HUD and prompts from their shown state.
  applyTable(): void;
  applyHud(): void;
  // Whether the card table is dealing right now.
  dealing(): boolean;
  // Turn the camera to a player (null: the normal view); done on arrival.
  lookAt(username: string | null, done: () => void, seconds?: number): void;
  // In portrait the camera must show the cards in play while one lands:
  // how fast it pans back to the middle and how long it stays after the card
  // has landed. Null where it need not (landscape).
  centreForPlays?(): { panSeconds: number; holdSeconds: number } | null;
  // A blind round's first prediction is yours: the camera may tour the other
  // players until the next snapshot (the prediction made, or the time up).
  startBlindTour?(state: PublicWizardGameState): void;
  stopBlindTour?(): void;
  // Done once every announcement has had its time.
  whenAnnouncerIdle(done: () => void): void;
  // Announces which suit is trumps, as the round's cards finish dealing.
  announceTrump(state: PublicWizardGameState): void;
  // The finished trick's gather and tesseract; done once it has gone.
  playTrickReward(done: () => void): void;
  // The cards a Thief swapped trade places; done once they have.
  playThiefSwap(done: () => void): void;
}

// A step that never reports back (a hidden tab pauses animation) mustn't stall
// the table for good.
const STEP_TIMEOUT_MS = 30000;

// The same move as before, the turn's deadline aside: the server sends the
// deadline in a snapshot of its own once a human's turn has begun.
const onlyDeadlineChanged = (previous: PublicWizardGameState, next: PublicWizardGameState) =>
  JSON.stringify({ ...previous, turnDeadlineAt: null }) ===
  JSON.stringify({ ...next, turnDeadlineAt: null });

// The same move as before, but for the player a Thief's winner has chosen so
// far: the camera is on that player and must not be turned back.
const onlyThiefTargetChanged = (previous: PublicWizardGameState, next: PublicWizardGameState) => {
  const before = previous.currentTrick.power;
  const after = next.currentTrick.power;
  if (before?.kind !== "thief" || after?.kind !== "thief" || before.resolved || after.resolved) return false;
  const bare = (state: PublicWizardGameState) =>
    JSON.stringify({
      ...state,
      turnDeadlineAt: null,
      currentTrick: { ...state.currentTrick, power: { ...state.currentTrick.power, target: null } },
    });
  return bare(previous) === bare(next);
};

// A Thief's swap has happened: both cards are in their new hands.
const thiefSwapped = (state: PublicWizardGameState | null) => {
  const power = state?.currentTrick.power;
  return power?.kind === "thief" && power.resolved && power.targetIndex != null;
};

// Only the cards in hand differ: a test shortcut swapped one, so the table
// just shows it, with no turn to replay.
const onlyHandsChanged = (previous: PublicWizardGameState, next: PublicWizardGameState) => {
  const bare = (state: PublicWizardGameState) =>
    JSON.stringify({ ...state, turnDeadlineAt: null, players: state.players.map((p) => ({ ...p, hand: null })) });
  return bare(previous) === bare(next) && JSON.stringify(previous.players) !== JSON.stringify(next.players);
};

const trickComplete = (state: PublicWizardGameState) =>
  !!state.currentTrick.winnerUsername && state.currentTrick.playedCards.length === state.players.length;

// Plays the server's snapshots out one at a time as a chain of steps, each
// starting when the one before reports done:
//
//   a move (a prediction, a trump choice): its announcement has its time, then
//     the next player is announced and the camera turns to them together.
//   a card played: it flies to the table, then the next player as above.
//   a trick won: the last card lands, the camera turns to the winner as the
//     tesseract flies and the win is announced. Mid-round it stays on them,
//     since they lead next; at the round's end it turns back to the middle.
//   a new round: last round's results have their time, the camera is back in
//     the middle, the cards are dealt, then the first player as above.
export function createTableDirector(options: TableDirectorOptions): TableDirector {
  let table = options.initial;
  let hud = options.initial;
  let shownTurn = false;
  let disposed = false;
  const queue: PublicWizardGameState[] = [];
  let running = false;
  let dealWaiters: Array<() => void> = [];

  const step = (start: (done: () => void) => void) =>
    new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve();
      };
      const timeout = window.setTimeout(() => {
        console.warn("[director] a step timed out; carrying on");
        done();
      }, STEP_TIMEOUT_MS);
      start(done);
    });
  // Durations here are written at the default pace; paced() scales them. The
  // step timeout above is not scaled: it is a guard against a step that never
  // reports back, not a beat.
  const wait = (seconds: number) => step((done) => window.setTimeout(done, paced(seconds) * 1000));
  const camera = (username: string | null, seconds?: number) =>
    step((done) => options.lookAt(username, done, seconds));
  const announcer = () => step((done) => options.whenAnnouncerIdle(done));

  const showTable = (state: PublicWizardGameState) => {
    table = state;
    options.applyTable();
  };
  const showHud = (state: PublicWizardGameState) => {
    hud = state;
    options.applyHud();
  };
  const hideTurn = () => {
    shownTurn = false;
    options.applyHud();
  };

  // Shows a round's snapshot on the table and waits while its cards are dealt.
  const deal = (state: PublicWizardGameState) =>
    step((done) => {
      dealWaiters.push(done);
      showTable(state);
      if (!options.dealing()) done();
    });

  // Announces whose move it is as the camera starts turning to them.
  const announceTurn = async (state: PublicWizardGameState) => {
    const current = state.phase === "finished" ? null : state.players[state.currentPlayerIndex]?.username ?? null;
    shownTurn = true;
    const arrived = camera(current);
    options.applyHud();
    await arrived;
    if (current === options.localUsername) options.startBlindTour?.(state);
  };

  const play = async (previous: PublicWizardGameState | null, next: PublicWizardGameState) => {
    // Nothing to play out: take the new deadline quietly, with the turn
    // still shown and its prompts left open.
    if (previous && onlyDeadlineChanged(previous, next)) {
      table = next;
      hud = next;
      options.applyHud();
      return;
    }

    if (previous && onlyHandsChanged(previous, next)) {
      table = next;
      hud = next;
      options.applyTable();
      options.applyHud();
      return;
    }

    // The winner has picked a player: the target is told, the camera stays.
    if (previous && onlyThiefTargetChanged(previous, next)) {
      table = next;
      hud = next;
      options.applyTable();
      options.applyHud();
      return;
    }

    hideTurn();
    options.stopBlindTour?.();

    if (!previous) {
      showHud(next);
      await deal(next); // settles at once when joining partway through a round
      // A game's first round starts here too, with nobody having predicted.
      if (next.players.every((player) => player.prediction === null) && !next.currentTrick.playedCards.length) {
        options.announceTrump(next);
        await announcer();
      }
      await announceTurn(next);
      return;
    }

    if (next.currentRound !== previous.currentRound) {
      showHud(next); // last round's results
      await announcer();
      await camera(null);
      await deal(next);
      // The trump colour is announced in full before the first player is
      // announced and the camera turns to them.
      options.announceTrump(next);
      await announcer();
      await announceTurn(next);
      return;
    }

    const centre = options.centreForPlays?.() ?? null;

    if (trickComplete(next) && !trickComplete(previous)) {
      showTable(next);
      // Portrait: back to the middle so the last card is seen landing.
      if (centre) void camera(null, centre.panSeconds);
      // The last card lands and the finished trick stays a moment.
      await wait(TRICK_REWARD.startDelaySeconds + TRICK_REWARD.winnerHoldSeconds);
      const winner = next.currentTrick.winnerUsername;
      const turned = camera(winner);
      const rewarded = step((done) => options.playTrickReward(done));
      showHud(next); // "X wins the trick"
      await Promise.all([turned, rewarded, announcer()]);
      // Mid-round the winner leads the next trick, so the camera stays on
      // them; at the end of the round it goes back to the middle for the
      // results and the next deal.
      if (next.players.every((player) => player.handCount === 0)) await camera(null);
      // The server's next snapshot clears the trick and moves on.
      return;
    }

    // A Thief's cards trade places, while the swap is announced; the camera
    // comes back to the middle once they have.
    if (thiefSwapped(next) && !thiefSwapped(previous)) {
      showTable(next);
      showHud(next);
      await step((done) => options.playThiefSwap(done));
      await announcer();
      await announceTurn(next);
      return;
    }

    const played = next.currentTrick.playedCards.length > previous.currentTrick.playedCards.length;
    const playedBy = played ? next.currentTrick.playedCards.at(-1)?.username : undefined;
    showTable(next);
    // Your own drops land where you put them; everyone else's cards fly,
    // including your NPC's when you're watching, and yours in a blind round.
    if (playedBy && (playedBy !== options.localUsername || isBotName(playedBy) || next.blindRound)) {
      // Portrait: the camera pans back to the middle as the card flies and
      // stays a moment after it lands, so the card played is seen.
      if (centre) void camera(null, centre.panSeconds);
      await wait(OPPONENT_PLAYS.liftSeconds + OPPONENT_PLAYS.travelSeconds + (centre?.holdSeconds ?? 0));
    }
    showHud(next); // a prediction or trump choice
    await announcer();
    await announceTurn(next);
  };

  const run = async () => {
    if (running) return;
    running = true;
    try {
      while (queue.length && !disposed) {
        const next = queue.shift()!;
        try {
          await play(table, next);
        } catch (error) {
          console.error("[director] step failed:", error);
          showTable(next);
          showHud(next);
        }
      }
    } finally {
      running = false;
    }
  };

  return {
    tableState: () => table,
    hudState: () => hud,
    turnShown: () => shownTurn,
    push(state) {
      // Once the game is over nothing more is played out.
      const last = queue.at(-1) ?? table;
      if (last?.phase === "finished") return;
      // A test shortcut changed a card in hand: show it now, whatever the table
      // is busy with, by putting the new hands into every state still to be shown.
      if (last && onlyHandsChanged(last, state)) {
        for (const shown of [table, hud, ...queue]) {
          if (!shown) continue;
          for (const player of shown.players) {
            const changed = state.players.find((other) => other.username === player.username);
            if (changed) player.hand = changed.hand;
          }
        }
        options.applyTable();
        options.applyHud();
        return;
      }
      queue.push(state);
      void run();
    },
    dealt() {
      const waiters = dealWaiters;
      dealWaiters = [];
      waiters.forEach((done) => done());
    },
    dispose() {
      disposed = true;
      options.stopBlindTour?.();
    },
  };
}
