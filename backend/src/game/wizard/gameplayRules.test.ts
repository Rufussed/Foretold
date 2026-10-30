import { describe, expect, it } from "vitest";

import { DEFAULT_GAME_OPTIONS, LEGACY_GAME_OPTIONS, normalizeGameOptions } from "./gameOptions.js";
import { forbiddenPrediction } from "./gameplayRules.js";

const players = (...predictions: (number | null)[]) => predictions.map((prediction) => ({ prediction }));

describe("forbiddenPrediction", () => {
  it("forbids the last predictor the number that adds up to the tricks", () => {
    expect(forbiddenPrediction(players(1, 2, 0, null), 5, true)).toBe(2);
  });

  it("forbids nothing while more than one player is still to predict", () => {
    expect(forbiddenPrediction(players(1, null, null), 5, true)).toBeNull();
  });

  it("forbids nothing once the others already bid more than the tricks", () => {
    expect(forbiddenPrediction(players(3, 3, null), 5, true)).toBeNull();
  });

  it("forbids nothing when the room set the last prediction free", () => {
    expect(forbiddenPrediction(players(1, 2, 0, null), 5, false)).toBeNull();
  });
});

describe("lastPredictionLimited", () => {
  it("is on in new rooms and in games saved before it was a choice", () => {
    expect(DEFAULT_GAME_OPTIONS.lastPredictionLimited).toBe(true);
    expect(normalizeGameOptions({}).lastPredictionLimited).toBe(true);
    expect(LEGACY_GAME_OPTIONS.lastPredictionLimited).toBe(true);
  });

  it("keeps the host's choice", () => {
    expect(normalizeGameOptions({ lastPredictionLimited: false }).lastPredictionLimited).toBe(false);
  });
});
