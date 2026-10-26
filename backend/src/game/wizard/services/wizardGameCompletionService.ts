import db, { transaction } from "../../../db/database.js";
import { isBotName } from "../models/bot.js";
import { fullRoundCount } from "../models/rounds.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { playerOpponentRepository } from "./playerOpponentRepository.js";
import { playerStatsRepository } from "./playerStatsRepository.js";
import { wizardGameRepository } from "./wizardGameRepository.js";

interface RoomInfo {
  createdBy: number;
  isGuest: number;
  inviteCode: string | null;
}

// A solo guest's table and a guest room both count for no one: no stats, no
// opponents remembered.
function countsForNoOne(room: RoomInfo): boolean {
  return room.isGuest === 1 || room.inviteCode !== null;
}

// The guests a guest room let in go with it: their accounts were only ever
// for this one game. Run inside the caller's transaction, before the room's
// seats are cleared.
function deleteInvitedGuests(roomId: number): void {
  const guests = db
    .prepare(`
      SELECT users.id
      FROM room_players
        JOIN users ON users.id = room_players.user_id
      WHERE room_players.room_id = ? AND users.is_guest = 1
    `)
    .all(roomId) as { id: number }[];

  for (const { id } of guests) {
    db.prepare("DELETE FROM room_players WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM player_opponents WHERE player_id = ?").run(id);
    db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ? AND is_guest = 1").run(id);
  }
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
          , users.is_guest AS isGuest
          , rooms.invite_code AS inviteCode
        FROM rooms
          JOIN users ON users.id = rooms.created_by
        WHERE rooms.id = ?
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

    // Bots take seats too, so they count towards the game's full length.
    const fullRounds = fullRoundCount(game.players.length);
    const fullGame =
      fullRounds !== undefined && game.totalRounds >= fullRounds;

    transaction(() => {
      for (const player of countsForNoOne(room) ? [] : game.players) {
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

        // A player who quit left it unfinished: it counts as played (from
        // the start), not as finished, so it lowers their reliability and
        // brings no win or points. Their opponents are still remembered.
        if (!player.quit) {
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
            fullGame,
          );
          playerStatsRepository.addColorTricks(
            roomPlayer.userId,
            player.colorTricks ?? {},
          );
        }

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

      deleteInvitedGuests(game.roomId);

      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(game.roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE rooms.id = ?
      `).run(game.roomId);

      if (room.isGuest === 1) {
        db.prepare(`
          DELETE FROM player_opponents
          WHERE player_id = ?
        `).run(room.createdBy);

        db.prepare(`
          DELETE FROM player_stats
          WHERE user_id = ?
        `).run(room.createdBy);

        db.prepare(`
          DELETE FROM users
          WHERE id = ? AND is_guest = 1
        `).run(room.createdBy);
      }
    });
  }

  expireGame(game: WizardGameState): void {
    const room = db
      .prepare(`
        SELECT created_by AS createdBy
          , users.is_guest AS isGuest
          , rooms.invite_code AS inviteCode
        FROM rooms
          JOIN users ON users.id = rooms.created_by
        WHERE rooms.id = ?
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

    transaction(() => {
      for (const player of countsForNoOne(room) ? [] : game.players) {
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

        /*
        * The game was played but not finished.
        *
        * We intentionally do NOT call recordFinishedGame()
        * because that would increment games_finished.
        */

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

      /*
      * Mark the game as expired before removing it.
      * This represents the state transition:
      *
      * playing → expired
      */
      db.prepare(`
        UPDATE games
        SET status = 'expired'
        WHERE room_id = ?
      `).run(game.roomId);

      /*
      * The room is also finished before it is removed.
      */
      db.prepare(`
        UPDATE rooms
        SET status = 'finished'
        WHERE id = ?
      `).run(game.roomId);

      wizardGameRepository.deleteGame(game.roomId);

      deleteInvitedGuests(game.roomId);

      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(game.roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(game.roomId);

      if (room.isGuest === 1) {
        db.prepare(`
          DELETE FROM player_opponents
          WHERE player_id = ?
        `).run(room.createdBy);

        db.prepare(`
          DELETE FROM player_stats
          WHERE user_id = ?
        `).run(room.createdBy);

        db.prepare(`
          DELETE FROM users
          WHERE id = ? AND is_guest = 1
        `).run(room.createdBy);
      }
    });
  }
}

export const wizardGameCompletionService =
  new WizardGameCompletionService();