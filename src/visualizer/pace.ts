import { GAMEPLAY_PACE, clampPace } from "../../backend/src/game/wizard/gameplayPace";

// The pace of the game being watched. The server chooses it in room setup and
// sends it with every snapshot, so both sides scale the same beats by the same
// number and the director never waits on an animation the server has already
// moved past.
//
// It is read fresh at each beat rather than captured, so a snapshot carrying a
// different pace takes effect from the next beat without anything being torn
// down. ?speed= overrides it for trying pacing out on a running game.

let current = GAMEPLAY_PACE.default;

// The newest snapshot's pace. Ignored while ?speed= is set, so a session being
// used to feel out the pacing is not overwritten by the server's value.
export const setPace = (pace: number): void => {
  if (overridden() !== null) return;
  current = clampPace(pace);
};

const overridden = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get("speed");
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? clampPace(value) : null;
};

export const pace = (): number => overridden() ?? current;

// A duration written at the default pace, in seconds, at the current pace.
// Every gameplay beat in the visualiser goes through this.
export const paced = (seconds: number): number => seconds / pace();
