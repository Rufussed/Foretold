import { describe, expect, it } from "vitest";
import { ScoreCalculator } from "./wizardScoreCalculator.js";

describe("ScoreCalculator.calculateRoundScore", () => {
  const calculator = new ScoreCalculator();

  it("gives two points plus one per trick for an exact prediction", () => {
    expect(calculator.calculateRoundScore(0, 0)).toBe(2);
    expect(calculator.calculateRoundScore(2, 2)).toBe(4);
    expect(calculator.calculateRoundScore(3, 3)).toBe(5);
  });

  it("loses one point per trick of difference for a miss", () => {
    expect(calculator.calculateRoundScore(2, 1)).toBe(-1);
    expect(calculator.calculateRoundScore(2, 0)).toBe(-2);
    expect(calculator.calculateRoundScore(0, 3)).toBe(-3);
  });
});
