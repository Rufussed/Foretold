import type { WizardGameState } from "../models/wizardGame.js";

export class WizardSessionManager {
  private readonly games = new Map<number, WizardGameState>();

  // This in-memory store is the single source of truth for active games. It
  // currently does not survive a backend restart.
  saveGame(game: WizardGameState): void {
    this.games.set(game.roomId, game);
  }

  //checks and sabes in one synchronous operation
  saveGameIfAbsent(game: WizardGameState): boolean {
    if (this.games.has(game.roomId)) {
      return false;
    }

    this.games.set(game.roomId, game);
    return true;
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
