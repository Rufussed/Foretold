import { WizardBotService } from "./wizardBotService.js";
import { WizardGameService } from "./wizardGameService.js";
import { wizardSessionManager } from "./wizardSessionManager.js";
import { wizardLobbyManager } from "./wizardLobbyManager.js";
import { WIZARD_TIMING } from "../wizardTiming.js";

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
        // Pause first, so every player sees who is choosing, then make sure
        // nothing changed meanwhile.
        await this.wait(WIZARD_TIMING.botTrumpDelayMs);
        const stillChoosing = wizardSessionManager.getGame(roomId);
        if (
          !stillChoosing ||
          stillChoosing.phase !== "trump-selection" ||
          stillChoosing.players[stillChoosing.currentPlayerIndex]?.username !== currentPlayer.username
        ) {
          continue;
        }

        const trumpSuit = this.botService.chooseTrumpSuit(stillChoosing);

        this.gameService.chooseTrumpSuit(
          stillChoosing,
          currentPlayer.username,
          trumpSuit,
        );

        wizardSessionManager.saveGame(stillChoosing);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      // --------------------------------------------------
      // BOT PREDICTION
      // --------------------------------------------------

      if (game.phase === "predictions") {
        // The same pause as before a bot plays, then make sure it's still
        // this bot's prediction to make.
        await this.wait(WIZARD_TIMING.botPlayDelayMs);
        const stillPredicting = wizardSessionManager.getGame(roomId);
        if (
          !stillPredicting ||
          stillPredicting.phase !== "predictions" ||
          stillPredicting.players[stillPredicting.currentPlayerIndex]?.username !== currentPlayer.username
        ) {
          continue;
        }

        const prediction =
          this.botService.choosePrediction(stillPredicting);

        this.gameService.submitPrediction(
          stillPredicting,
          currentPlayer.username,
          prediction,
        );

        wizardSessionManager.saveGame(stillPredicting);
        this.broadcast(roomId);

        await this.wait(700);
        continue;
      }

      // --------------------------------------------------
      // BOT CARD
      // --------------------------------------------------

      if (game.phase === "playing") {
        // Give the table a moment to follow along before a bot plays.
        await this.wait(WIZARD_TIMING.botPlayDelayMs);

        const currentGame =
          wizardSessionManager.getGame(roomId);

        if (!currentGame) {
          return;
        }

        // The game may have moved on while the bot waited.
        const stillBotsTurn =
          currentGame.phase === "playing" &&
          currentGame.players[currentGame.currentPlayerIndex]?.username ===
            currentPlayer.username &&
          currentGame.currentTrick.playedCards.length <
            currentGame.players.length;

        if (!stillBotsTurn) {
          continue;
        }

        const cardIndex =
          this.botService.chooseCardIndex(currentGame);

        this.gameService.playCard(currentGame, cardIndex);

        wizardSessionManager.saveGame(currentGame);
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