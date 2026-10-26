import { WizardBotService } from "./wizardBotService.js";
import { WizardGameService } from "./wizardGameService.js";
import { wizardSessionManager } from "./wizardSessionManager.js";
import { WIZARD_TIMING } from "../wizardTiming.js";
import { clampPace, paced } from "../gameplayPace.js";
import { wizardGameCompletionService } from "./wizardGameCompletionService.js";
import { isPlayedByServer, recordMissedTurn } from "./playerQuit.js";
import { isBotName } from "../models/bot.js";

export type GameStateBroadcaster = (
  roomId: number,
) => void;

// Advances bot turns automatically while yielding on human turns. The socket
// handler starts this runner again whenever a human submits an action.
export class WizardGameRunner {
  private readonly botService: WizardBotService;
  private readonly runningRooms = new Set<number>();
  private readonly decisionWakeups = new Map<number, () => void>();

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

        // Every pause below is written at the default pace; this divides them.
        const pace = clampPace(game.pace);

        if (game.phase === "finished") {
          // Send the final game state before cleanup.
          this.broadcast(roomId);

          // Give the frontend time to receive/display the final state.
          await this.wait(WIZARD_TIMING.finishedHoldMs, pace);

          // Record statistics and remove the temporary game/room data.
          wizardGameCompletionService.completeGame(game);

          // Finally remove the active in-memory game.
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
          await this.wait(WIZARD_TIMING.trickHoldMs, pace);

          const currentGame =
            wizardSessionManager.getGame(roomId);

          if (!currentGame) {
            return;
          }

          this.gameService.advanceAfterTrick(currentGame);

          wizardSessionManager.saveGame(currentGame);
          this.broadcast(roomId);

          await this.wait(WIZARD_TIMING.afterMoveMs, pace);
          continue;
        }

        const currentPlayer =
          game.players[game.currentPlayerIndex];

        if (!currentPlayer) {
          return;
        }
        
        let timedOutHuman = false;

        // HUMAN TURN: wait for the player, or let the bot decide when the timer
        // expires. A player who quit is played like a bot, without waiting.
        if (!isPlayedByServer(currentPlayer)) {
          const getDecisionKey = (state: typeof game): string => {
            const player = state.players[state.currentPlayerIndex];

            return [
              state.phase,
              state.currentRound,
              player?.username ?? "",
              state.currentTrick.playedCards.length,
            ].join(":");
          };

          const decisionKey = getDecisionKey(game);
          const timeoutMs = game.turnTimeoutMs;

          // A decision with a time limit starts its countdown once the
          // player's table has shown them their turn, after any walk-in and
          // deal: their client says so (turn_ready, which sets the deadline in
          // wizardSocket.ts and wakes this). If it never does, the countdown
          // starts anyway after turnReadyWaitMs.
          if (timeoutMs !== null && game.turnDeadlineAt === null) {
            await this.waitForDecision(roomId, WIZARD_TIMING.turnReadyWaitMs);

            const waited = wizardSessionManager.getGame(roomId);

            if (!waited) {
              return;
            }

            if (getDecisionKey(waited) === decisionKey && waited.turnDeadlineAt === null) {
              waited.turnDeadlineAt = Date.now() + timeoutMs;

              wizardSessionManager.saveGame(waited);
              this.broadcast(roomId);
            }

            // Look again: the countdown is running, or the move was made.
            continue;
          }

          const deadline = game.turnDeadlineAt;

          // No timer: wait indefinitely for a human action.
          // Otherwise, wait only for the remaining time.
          const remaining =
            deadline === null ? null : Math.max(0, deadline - Date.now());

          await this.waitForDecision(roomId, remaining);

          // The game may have changed while the runner was waiting.
          const currentGame = wizardSessionManager.getGame(roomId);

          if (!currentGame) {
            return;
          }

          // Never make a move for an old or already completed decision.
          if (
            getDecisionKey(currentGame) !== decisionKey ||
            currentGame.turnDeadlineAt !== deadline
          ) {
            continue;
          }

          // With no timer, keep waiting until the human acts.
          if (deadline === null) {
            continue;
          }

          // The deadline may have been extended or the timer may have fired early.
          if (Date.now() < deadline) {
            continue;
          }

          const timedOutPlayer =
            currentGame.players[currentGame.currentPlayerIndex];
          if (!timedOutPlayer || isPlayedByServer(timedOutPlayer)) {
            continue;
          }

          // The timeout has expired. Continue into the bot decision logic
          // below, but use the current game state. Enough misses in a row
          // are a quit (playerQuit.ts); the seat is then played like a bot's.
          if (recordMissedTurn(currentGame, timedOutPlayer.username)) {
            console.log(
              `[wizard] room ${roomId}: ${timedOutPlayer.username} missed too many turns and has quit`,
            );
          }
          wizardSessionManager.saveGame(currentGame);

          timedOutHuman = true;
        }

        const decisionGame = timedOutHuman
          ? wizardSessionManager.getGame(roomId)
          : game;

        if (!decisionGame) {
          return;
        }

        const decisionPlayer =
          decisionGame.players[decisionGame.currentPlayerIndex];

        if (!decisionPlayer) {
          return;
        }

        // If a human timed out, clear the deadline before making the
        // decision so the next turn can receive its own deadline.
        
        // --------------------------------------------------
        // BOT TRUMP SELECTION
        if (decisionGame.phase === "trump-selection") {
          // Pause first, so every player sees who is choosing, then make sure
          // nothing changed meanwhile.
          await this.wait(WIZARD_TIMING.botTrumpDelayMs, pace);
          const stillChoosing = wizardSessionManager.getGame(roomId);
          if (
            !stillChoosing ||
            stillChoosing.phase !== "trump-selection" ||
            stillChoosing.turnDeadlineAt !== decisionGame.turnDeadlineAt ||
            stillChoosing.players[stillChoosing.currentPlayerIndex]?.username !== decisionPlayer.username
          ) {
            continue;
          }

          const trumpSuit = this.botService.chooseTrumpSuit(stillChoosing);

          this.gameService.chooseTrumpSuit(
            stillChoosing,
            decisionPlayer.username,
            trumpSuit,
          );

          stillChoosing.turnDeadlineAt = null;
          wizardSessionManager.saveGame(stillChoosing);
          this.broadcast(roomId);

          await this.wait(WIZARD_TIMING.afterMoveMs, pace);
          continue;
        }

        // --------------------------------------------------
        // BOT PREDICTION
        // --------------------------------------------------

        if (decisionGame.phase === "predictions") {
          // The same pause as before a bot plays, then make sure it's still
          // this bot's prediction to make.
          await this.wait(WIZARD_TIMING.botPlayDelayMs, pace);
          const stillPredicting = wizardSessionManager.getGame(roomId);
          if (
            !stillPredicting ||
            stillPredicting.phase !== "predictions" ||
            stillPredicting.turnDeadlineAt !== decisionGame.turnDeadlineAt ||
            stillPredicting.players[stillPredicting.currentPlayerIndex]?.username !== decisionPlayer.username
          ) {
            continue;
          }

          const prediction =
            this.botService.choosePrediction(stillPredicting);

          this.gameService.submitPrediction(
            stillPredicting,
            decisionPlayer.username,
            prediction,
          );

          stillPredicting.turnDeadlineAt = null;
          wizardSessionManager.saveGame(stillPredicting);
          this.broadcast(roomId);

          await this.wait(WIZARD_TIMING.afterMoveMs, pace);
          continue;
        }

        // --------------------------------------------------
        // BOT CARD
        // --------------------------------------------------

        if (decisionGame.phase === "playing") {
          // Give the table a moment to follow along before a bot plays.
          await this.wait(WIZARD_TIMING.botPlayDelayMs, pace);

          const currentGame =
            wizardSessionManager.getGame(roomId);

          if (!currentGame) {
            return;
          }

          // The game may have moved on while the bot waited.
          const stillBotsTurn =
            currentGame.phase === "playing" &&
            currentGame.turnDeadlineAt === decisionGame.turnDeadlineAt &&
            currentGame.players[currentGame.currentPlayerIndex]?.username ===
              decisionPlayer.username &&
            currentGame.currentTrick.playedCards.length <
              currentGame.players.length;

          if (!stillBotsTurn) {
            continue;
          }

          const cardIndex =
            this.botService.chooseCardIndex(currentGame);

          // A human's card played for them is marked, so it brings them no
          // colour points (strongColor.ts).
          this.gameService.playCard(
            currentGame,
            cardIndex,
            !isBotName(decisionPlayer.username),
          );

          currentGame.turnDeadlineAt = null;
          wizardSessionManager.saveGame(currentGame);
          this.broadcast(roomId);

          await this.wait(WIZARD_TIMING.afterMoveMs, pace);
          continue;
        }

        return;
      }
    } finally {
      this.runningRooms.delete(roomId);
    }
}

  notifyAction(roomId: number): void {
    this.decisionWakeups.get(roomId)?.();
  }

    private waitForDecision(
      roomId: number,
      milliseconds: number | null,
    ): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timer);

        if (this.decisionWakeups.get(roomId) === finish) {
          this.decisionWakeups.delete(roomId);
        }

        resolve();
      };

      if (milliseconds !== null) {
       timer = setTimeout(finish, milliseconds);
      }
      this.decisionWakeups.set(roomId, finish);
    });
  }
  // Waits a duration written at the default pace, scaled to this game's pace.
  // Scaling here rather than at each call site means every pause the runner
  // takes is paced, including any added later.
  private wait(milliseconds: number, pace: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, paced(milliseconds, pace));
    });
  }
}