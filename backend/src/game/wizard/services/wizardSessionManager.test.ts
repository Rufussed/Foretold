import { describe, it, expect } from "vitest";
import { WizardSessionManager } from "./wizardSessionManager.js";
import type { WizardGameState } from "../models/wizardGame.js";

describe("WizardSessionManager", () => {
  it("only saves the first game for a room", () => {
    const manager = new WizardSessionManager();

    const game1 = {
      roomId: 123,
    } as WizardGameState;

    const game2 = {
      roomId: 123,
    } as WizardGameState;

    const firstResult = manager.saveGameIfAbsent(game1);
    const secondResult = manager.saveGameIfAbsent(game2);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
    expect(manager.getGame(123)).toBe(game1);
  });
});