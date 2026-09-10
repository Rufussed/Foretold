import { WizardBotService } from "./wizardBotService.js";
import { WizardGameService } from "./wizardGameService.js";
import { wizardSessionManager } from "./wizardSessionManager.js";
import { wizardLobbyManager } from "./wizardLobbyManager.js";

export type GameStateBroadcaster = (
  roomId: number,
) => void;

// Advances bot turns automatically while yielding on human turns. The socket
// handler starts this runner again whenever a human submits an action.
export class WizardGameRunner {
  private readonly botService: WizardBotService;
  private readonly runningRooms = new Set<number>();

  constructor(
    private readonly gameService: WizardGameService,
    private readonly broadcast: GameStateBroadcaster,
  ) {
    this.botService = new WizardBotService(gameService);
  }

async run(roomId: number): Promise<void> {
  // A Set prevents simultaneous runner loops from processing the same room.
  if (this.runningRooms.has(roomId)) {
    return;
  }

  this.runningRooms.add(roomId);

  try {
    while (true) {
      const game = wizardSessionManager.getGame(roomId);

      if (!game) {
        return;
      }

      if (game.phase === "finished") {
        // Finished games are removed from memory and their lobby becomes
        // available for a new game.
        wizardLobbyManager.setRoomStatus(roomId, "waiting");
        wizardSessionManager.deleteGame(roomId);
        return;
      }

      // --------------------------------------------------
      // COMPLETED TRICK
      // --------------------------------------------------

      if (
        game.phase === "playing" &&
        game.currentTrick.playedCards.length ===
          game.players.length
      ) {
        // Keep the completed trick visible briefly before clearing it and
        // moving the winner into the lead position.
        await this.wait(2500);

        const currentGame =
          wizardSessionManager.getGame(roomId);

        if (!currentGame) {
          return;
        }

        this.gameService.advanceAfterTrick(currentGame);

        wizardSessionManager.saveGame(currentGame);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      const currentPlayer =
        game.players[game.currentPlayerIndex];

      if (!currentPlayer) {
        return;
      }

      // Human's turn: stop and wait for the socket to trigger the runner after
      // the human acts.
      if (!this.botService.isBot(currentPlayer.username)) {
        return;
      }

      // --------------------------------------------------
      // BOT TRUMP SELECTION
      // --------------------------------------------------

      if (game.phase === "trump-selection") {
        const trumpSuit = this.botService.chooseTrumpSuit(game);

        this.gameService.chooseTrumpSuit(
          game,
          currentPlayer.username,
          trumpSuit,
        );

        wizardSessionManager.saveGame(game);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      // --------------------------------------------------
      // BOT PREDICTION
      // --------------------------------------------------

      if (game.phase === "predictions") {
        const prediction =
          this.botService.choosePrediction(game);

        this.gameService.submitPrediction(
          game,
          currentPlayer.username,
          prediction,
        );

        wizardSessionManager.saveGame(game);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      // --------------------------------------------------
      // BOT CARD
      // --------------------------------------------------

      if (game.phase === "playing") {
        const cardIndex =
          this.botService.chooseCardIndex(game);

        this.gameService.playCard(game, cardIndex);

        wizardSessionManager.saveGame(game);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      return;
    }
  } finally {
    this.runningRooms.delete(roomId);
  }
}

  private wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}