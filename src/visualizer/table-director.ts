import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { OPPONENT_PLAYS, TRICK_REWARD } from "./config";

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
  lookAt(username: string | null, done: () => void): void;
  // Done once every announcement has had its time.
  whenAnnouncerIdle(done: () => void): void;
  // The finished trick's gather and tesseract; done once it has gone.
  playTrickReward(done: () => void): void;
}

// A step that never reports back (a hidden tab pauses animation) mustn't stall
// the table for good.
const STEP_TIMEOUT_MS = 30000;

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
  const wait = (seconds: number) => step((done) => window.setTimeout(done, seconds * 1000));
  const camera = (username: string | null) => step((done) => options.lookAt(username, done));
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
  };

  const play = async (previous: PublicWizardGameState | null, next: PublicWizardGameState) => {
    hideTurn();

    if (!previous) {
      showHud(next);
      await deal(next); // settles at once when joining partway through a round
      await announceTurn(next);
      return;
    }

    if (next.currentRound !== previous.currentRound) {
      showHud(next); // last round's results
      await announcer();
      await camera(null);
      await deal(next);
      await announceTurn(next);
      return;
    }

    if (trickComplete(next) && !trickComplete(previous)) {
      showTable(next);
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

    const played = next.currentTrick.playedCards.length > previous.currentTrick.playedCards.length;
    const playedBy = played ? next.currentTrick.playedCards.at(-1)?.username : undefined;
    showTable(next);
    // Your own drops land where you put them; everyone else's cards fly,
    // including your NPC's when you're watching.
    if (playedBy && (playedBy !== options.localUsername || isBotName(playedBy))) {
      await wait(OPPONENT_PLAYS.liftSeconds + OPPONENT_PLAYS.travelSeconds);
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
    },
  };
}
