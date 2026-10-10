// How fast a game plays out, as one number shared by both sides.
//
// Every duration in the visualiser's config.ts and every wait in
// wizardTiming.ts is written at the default pace of 1. The pace divides them:
// 2 runs the game twice as fast, 0.5 at half speed. It covers the beats a
// player experiences as the game's rhythm - the camera turning to whoever is
// playing, how long an announcement holds, cards flying and being dealt, the
// trick's tesseract, and how long a bot thinks before it moves - so the
// server's pauses and the animations they are timed against stay in step.
//
// It deliberately leaves alone anything that is not a turn beat: emote
// crossfades and cooldowns, the trump crown's bob, torch sparks, the backdrop's
// rotation, and the two network timeouts (a played card waiting to be accepted,
// and the director's per-step timeout), which must not shrink just because the
// game is being played faster.
//
// This file lives under backend/src because it is the only direction that
// works: the backend's tsconfig sets rootDir to ./src, so it cannot reach into
// the frontend, while the frontend already imports values from here (see
// table-director.ts). It must stay free of process.env and any other Node-only
// reference, because Vite bundles it into the browser - that is why the bot
// delays and their environment overrides stay in wizardTiming.ts.

export const GAMEPLAY_PACE = {
  // The pace every duration on both sides is written at.
  default: 1,
  // Slower than this and a game drags; faster and the table is hard to follow.
  min: 0.5,
  max: 3,
};

// The pace to actually use, given whatever arrived from a client, a query
// string or an older saved game with no pace recorded at all.
export const clampPace = (value: unknown): number => {
  const pace = Number(value);
  if (!Number.isFinite(pace) || pace <= 0) return GAMEPLAY_PACE.default;
  return Math.min(GAMEPLAY_PACE.max, Math.max(GAMEPLAY_PACE.min, pace));
};

// A duration written at the default pace, in whatever unit, at the pace given.
export const paced = (duration: number, pace: number): number =>
  duration / clampPace(pace);
