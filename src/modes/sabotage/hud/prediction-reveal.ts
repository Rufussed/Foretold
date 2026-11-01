// A Sabotage Seer or Trickster changes a prediction already made. The
// player list (visualizer/hud/player-list.ts) keeps showing the old number
// until the change is announced, then swells and flashes the new one. In other
// modes a prediction never changes once made, so this never holds one back.

// A changed prediction is shown as it is announced. If the announcement never
// comes up, it shows anyway after this long.
const REVEAL_FALLBACK_MS = 20_000;

export interface PredictionReveal {
  // The number to show for this player now: a changed prediction's old number
  // until revealed. holding: the list still shows the round just scored.
  shown(username: string, prediction: number | null, round: number, holding: boolean): number | null;
  // The list has drawn every row for this state.
  drawn(round: number, holding: boolean): void;
  // The announcement is up: show the new number.
  reveal(username: string, byOther?: boolean): void;
  dispose(): void;
}

// onReveal sets and flashes the number in the player's row.
export function createPredictionReveal(onReveal: (username: string, to: number, byOther: boolean) => void): PredictionReveal {
  // Each player's prediction as last shown, and the round it was for, to tell
  // a prediction being changed from one being made.
  const shownPredictions = new Map<string, number | null>();
  let shownRound: number | undefined;
  // Changes not announced yet: the row keeps its old number until reveal.
  const pending = new Map<string, { from: number; to: number; timer: number }>();

  const settle = () => {
    for (const change of pending.values()) window.clearTimeout(change.timer);
    pending.clear();
  };

  const reveal = (username: string, byOther = false) => {
    const change = pending.get(username);
    if (!change) return;
    window.clearTimeout(change.timer);
    pending.delete(username);
    shownPredictions.set(username, change.to);
    onReveal(username, change.to, byOther);
  };

  return {
    shown(username, prediction, round, holding) {
      // A round's end settles anything still waiting, without the fuss.
      if (holding || (shownRound !== undefined && shownRound !== round)) settle();
      if (holding) return prediction;

      const before = shownPredictions.get(username);
      const waiting = pending.get(username);
      if (waiting && prediction !== null) {
        waiting.to = prediction;
        return waiting.from;
      }
      if (shownRound === round && before != null && prediction !== null && prediction !== before) {
        pending.set(username, {
          from: before,
          to: prediction,
          timer: window.setTimeout(() => reveal(username), REVEAL_FALLBACK_MS),
        });
        return before;
      }
      shownPredictions.set(username, prediction);
      return prediction;
    },

    drawn(round, holding) {
      if (!holding) shownRound = round;
    },

    reveal,

    dispose: settle,
  };
}
