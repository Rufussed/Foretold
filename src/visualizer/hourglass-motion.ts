// Where the turn hourglass is in its turn, as plain numbers; turn-hourglass.ts
// draws it. One turn is: the flip (the run-out sand turns over with the
// glass), the settle (the sand slides down onto the neck), the drain, and the
// clear (the last grains in the stream fall), ending as the time is up.
// blender/build_hourglass.py builds the model and its shape keys to match.

export interface HourglassPose {
  // How far through the flip, 0 upright .. 1 turned over.
  turn: number;
  // Drain progress, 0 full .. 1 the top empty.
  drain: number;
  // Clear progress, after the drain: the stream's last grains falling, 1 gone.
  clear: number;
  // Settle progress, 0 just flipped .. 1 settled onto the neck.
  settle: number;
}

export interface HourglassTimeline {
  start: number; // seconds, on the caller's clock
  flipSeconds: number;
  settleSeconds: number;
  // The drain runs from drainFrom at drainStart to empty at drainEnd, and
  // the clear follows for clearSeconds.
  drainStart: number;
  drainFrom: number;
  drainEnd: number;
  clearSeconds: number;
}

// The sand run out and upright: before the first turn, and between turns.
export const RUN_OUT: HourglassPose = { turn: 0, drain: 1, settle: 1, clear: 1 };

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

// Eases in and out, as the flip does in Blender.
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

export interface HourglassTimings {
  flipSeconds: number;
  settleSeconds: number;
  clearSeconds: number;
}

// A turn of totalSeconds starting at now. The flip, settle and clear come out
// of the total, so the sand runs out when the time does.
export function startTimeline(
  now: number,
  totalSeconds: number,
  { flipSeconds, settleSeconds, clearSeconds }: HourglassTimings,
): HourglassTimeline {
  const drainStart = now + flipSeconds + settleSeconds;
  return {
    start: now,
    flipSeconds,
    settleSeconds,
    drainStart,
    drainFrom: 0,
    // Never shorter than a moment, even if the turn is shorter than the flip.
    drainEnd: Math.max(now + totalSeconds - clearSeconds, drainStart + 0.1),
    clearSeconds,
  };
}

export function poseAt(timeline: HourglassTimeline, now: number): HourglassPose {
  const elapsed = now - timeline.start;
  if (elapsed < timeline.flipSeconds) {
    return { ...RUN_OUT, turn: ease(clamp01(elapsed / timeline.flipSeconds)) };
  }
  if (now < timeline.drainStart) {
    const settle = (elapsed - timeline.flipSeconds) / timeline.settleSeconds;
    return { turn: 0, drain: 0, settle: clamp01(settle), clear: 0 };
  }
  const run = (now - timeline.drainStart) / (timeline.drainEnd - timeline.drainStart);
  return {
    turn: 0,
    drain: timeline.drainFrom + (1 - timeline.drainFrom) * clamp01(run),
    settle: 1,
    clear: clamp01((now - timeline.drainEnd) / timeline.clearSeconds),
  };
}

// The move came in early: whatever sand is left runs out over finishSeconds,
// then clears. A flip or settle still under way plays out first.
export function finishTimeline(
  timeline: HourglassTimeline,
  now: number,
  finishSeconds: number,
): HourglassTimeline {
  if (now < timeline.drainStart) {
    return { ...timeline, drainEnd: timeline.drainStart + finishSeconds };
  }
  // Already empty and clearing: let it finish as it is.
  if (now >= timeline.drainEnd) return timeline;
  const { drain } = poseAt(timeline, now);
  return { ...timeline, drainStart: now, drainFrom: drain, drainEnd: now + finishSeconds };
}

export const timelineDone = (timeline: HourglassTimeline, now: number) =>
  now >= timeline.drainEnd + timeline.clearSeconds;

// Weights for a chain of step shape keys at progress 0 .. 1: the steps
// already taken at 1, the current one partway, the rest 0.
export function stepWeights(progress: number, steps: number): number[] {
  return Array.from({ length: steps }, (_, index) =>
    clamp01(progress * steps - index),
  );
}
