import db, { transaction } from "../../../db/database.js";
import { isBotName } from "../models/bot.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { playerOpponentRepository } from "./playerOpponentRepository.js";
import { playerStatsRepository } from "./playerStatsRepository.js";
import { wizardGameRepository } from "./wizardGameRepository.js";

interface RoomInfo {
  createdBy: number;
}

interface RoomPlayerInfo {
  userId: number;
  username: string;
}

class WizardGameCompletionService {
  completeGame(game: WizardGameState): void {
    const room = db
      .prepare(`
        SELECT created_by AS createdBy
        FROM rooms
        WHERE id = ?
      `)
      .get(game.roomId) as RoomInfo | undefined;

    if (!room) {
      throw new Error(`Room ${game.roomId} not found`);
    }

    const roomPlayers = db
      .prepare(`
        SELECT
          user_id AS userId,
          username
        FROM room_players
        WHERE room_id = ?
      `)
      .all(game.roomId) as RoomPlayerInfo[];

    const winner = game.players.length > 0
      ? game.players.reduce((currentWinner, player) =>
          player.score > currentWinner.score
            ? player
            : currentWinner,
        )
      : null;

    transaction(() => {
      for (const player of game.players) {
        if (isBotName(player.username)) {
          continue;
        }

        const roomPlayer = roomPlayers.find(
          (roomPlayer) => roomPlayer.username === player.username,
        );

        if (!roomPlayer) {
          throw new Error(
            `Human player ${player.username} not found in room`,
          );
        }

        playerStatsRepository.recordFinishedGame(
          roomPlayer.userId,
          winner?.username === player.username ? 1 : 0,
          player.score,
          player.tricksWon,
          player.roundScores.length,
          player.roundScores.filter(
            (round) => round.prediction === round.tricksWon,
          ).length,
          room.createdBy === roomPlayer.userId ? 1 : 0,
        );

        for (const opponent of game.players) {
          if (opponent.username === player.username) {
            continue;
          }

          if (isBotName(opponent.username)) {
            playerOpponentRepository.recordGameAgainstBot(
              roomPlayer.userId,
              opponent.username,
            );
            continue;
          }

          const opponentRoomPlayer = roomPlayers.find(
            (roomPlayer) => roomPlayer.username === opponent.username,
          );

          if (!opponentRoomPlayer) {
            throw new Error(
              `Human opponent ${opponent.username} not found in room`,
            );
          }

          playerOpponentRepository.recordGameAgainstUser(
            roomPlayer.userId,
            opponentRoomPlayer.userId,
            opponentRoomPlayer.username,
          );
        }
      }

      wizardGameRepository.deleteGame(game.roomId);

      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(game.roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(game.roomId);
    });
  }
}

export const wizardGameCompletionService =
  new WizardGameCompletionService();