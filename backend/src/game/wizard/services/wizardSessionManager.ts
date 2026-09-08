import type { WizardGameState } from "../models/wizardGame.js";

class WizardSessionManager {
  private readonly games = new Map<number, WizardGameState>();

  saveGame(game: WizardGameState): void {
    this.games.set(game.roomId, game);
  }

  getGame(roomId: number): WizardGameState | null {
    return this.games.get(roomId) ?? null;
  }

  hasGame(roomId: number): boolean {
    return this.games.has(roomId);
  }

  deleteGame(roomId: number): void {
    this.games.delete(roomId);
  }
}

export const wizardSessionManager = new WizardSessionManager();
