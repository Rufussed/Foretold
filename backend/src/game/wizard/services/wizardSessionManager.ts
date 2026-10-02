import type { WizardGameState } from "../models/wizardGame.js";
import { wizardGameRepository } from "./wizardGameRepository.js";
import { wizardGameCompletionService } from "./wizardGameCompletionService.js";

export class WizardSessionManager {
  private readonly games = new Map<number, WizardGameState>();

  saveGame(game: WizardGameState): void {
    this.games.set(game.roomId, game);
    wizardGameRepository.saveGame(game);
  }

  // Checks and saves in one synchronous operation.
  saveGameIfAbsent(game: WizardGameState): boolean {
    if (this.games.has(game.roomId)) {
      return false;
    }

    this.games.set(game.roomId, game);
    wizardGameRepository.saveGame(game);
    return true;
  }

  getGame(roomId: number): WizardGameState | null {
    const activeGame = this.games.get(roomId);

    if (activeGame) {
      if (wizardGameRepository.isGameExpired(roomId)) {
        this.games.delete(roomId);
        wizardGameCompletionService.expireGame(activeGame);
        return null;
      }

      return activeGame;
    }

    const savedGame = wizardGameRepository.loadGame(roomId);

    if (!savedGame || savedGame.status === "finished") {
      return null;
    }

    if (wizardGameRepository.isGameExpired(roomId)) {
      wizardGameCompletionService.expireGame(savedGame);
      return null;
    }

    this.games.set(roomId, savedGame);
    return savedGame;
  }

  hasGame(roomId: number): boolean {
    return this.games.has(roomId);
  }

  deleteGame(roomId: number): void {
    this.games.delete(roomId);
  }
}

export const wizardSessionManager = new WizardSessionManager();