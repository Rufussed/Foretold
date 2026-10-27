import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { BOT_NAME_SUFFIX, isBotName, seatNameFor } from "../models/bot.js";
import { pickBotNames } from "../botNames.js";
import { wizardLobbyManager } from "../services/wizardLobbyManager.js";
import { assignAvatars, shuffledSeating, WizardGameService } from "../services/wizardGameService.js";
import { wizardSessionManager } from "../services/wizardSessionManager.js";
import { broadcastGameState, registerWizardSocket } from "../websocket/wizardSocket.js";
import { activeHumans, hasQuit, quitPlayer, recordOwnMove } from "../services/playerQuit.js";
import { wizardGameCompletionService } from "../services/wizardGameCompletionService.js";
import { WizardGameRunner } from "../services/wizardGameRunner.js";
import { AVATAR_IDS, isAvatarId, type AvatarId } from "../models/avatar.js";
import { fullRoundCount } from "../models/rounds.js";
import { clampPace } from "../gameplayPace.js";
import { DEFAULT_GAME_OPTIONS, normalizeGameOptions } from "../gameOptions.js";
import { GAME_MODES, type GameMode } from "../modes/modes.js";
import { ROLES, type RoleId } from "../modes/roles/roles.js";
import { assignRoles } from "../modes/roles/assignRoles.js";
import { BOT_LEVELS, normalizeBotLevel } from "../botLevels.js";
import { assignBotPersonalities } from "../bots/index.js";
import { isTurnTimeoutMs } from "../turnTimeout.js";
import db from "../../../db/database.js";
import { playerStatsRepository } from "../services/playerStatsRepository.js";
import { friendService } from "../services/friendService.js";
import { deleteGuest } from "../services/guestCleanup.js";
import { containsProfanity } from "../../../services/profanityFilter.js";

interface CreateGameBody {
  roomId?: number;
  botCount?: number;
  // Optional cap for a shorter game, 1 up to a full game's rounds.
  maxRounds?: number;
  // How fast the game plays out, chosen in room setup. Out-of-range values are
  // clamped rather than refused, so a stale client cannot fail to start a game.
  pace?: number;
  // The rule variations (see gameOptions.ts); left out, the official ones.
  wizardWins?: "first" | "last";
  blindFirstRound?: boolean;
  missedTurnsToQuit?: 3 | 5 | 7 | 9 | null;
  // How well the NPCs play (see botLevels.ts); left out, the Apprentice.
  botLevel?: string;
}

interface PredictionBody {
  prediction?: number;
}

interface PlayCardBody {
  cardIndex?: number;
}

// A running game marks the players who quit, so their pages stop calling them
// back to the table (the lobby, the room page and services/started-game.ts).
function withQuitPlayers<
  T extends { id: number; status: string; players: { username: string }[] },
>(room: T): T {
  if (room.status !== "playing") {
    return room;
  }

  const game = wizardSessionManager.getGame(room.id);

  if (!game) {
    return room;
  }

  return {
    ...room,
    players: room.players.map((player) => ({
      ...player,
      quit: hasQuit(game, player.username),
    })),
  };
}

// A host may open this many guest rooms an hour, so the open invite link
// cannot be used to spam rooms. Kept in memory: a restart forgets it.
const GUEST_ROOMS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
const guestRoomsOpened = new Map<number, number[]>();

function guestRoomAllowed(userId: number): boolean {
  const now = Date.now();
  const recent = (guestRoomsOpened.get(userId) ?? []).filter(
    (time) => now - time < HOUR_MS,
  );

  if (recent.length >= GUEST_ROOMS_PER_HOUR) {
    guestRoomsOpened.set(userId, recent);
    return false;
  }

  guestRoomsOpened.set(userId, [...recent, now]);
  return true;
}

// The name an invited guest chooses for one game. Any name will do, even one
// a wizard already has or another guest at the table chose: it is shown in
// place of the generated part of their username (Guest-1a2b3c4d-Anna, see the
// frontend's utils/display-name.ts), which stays unique. Letters of any
// language, digits, spaces and a few marks.
const GUEST_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _'.-]{0,19}$/u;

// An invited guest's login lasts the longest game with room to spare.
const INVITED_GUEST_TOKEN_HOURS = 4;

const INVITE_CODE_PARAMS = {
  type: "object",
  required: ["code"],
  additionalProperties: false,
  properties: {
    code: { type: "string", pattern: "^[A-Za-z0-9_-]{10}$" },
  },
} as const;

function getAuthenticatedUsername(request: {
  user: unknown;
}): string | null {
  const tokenUser = request.user as { username?: string };

  return tokenUser.username ?? null;
}

export default async function wizardRoutes(
  server: FastifyInstance,
): Promise<void> {
  const wizardGameService = new WizardGameService();

  const wizardGameRunner =
    registerWizardSocket(server, wizardGameService);

  // A player leaving a running game for good: the server plays the seat from
  // now on, and the others go on without waiting (see playerQuit.ts). When the
  // last human leaves, the game ends there, unfinished for everyone. True if
  // it ended.
  const leaveGame = (roomId: number, username: string): boolean => {
    const game = wizardSessionManager.getGame(roomId);

    if (!game) {
      return false;
    }

    quitPlayer(game, username);

    if (activeHumans(game).length === 0) {
      wizardGameCompletionService.expireGame(game);
      wizardSessionManager.deleteGame(roomId);
      wizardGameRunner.notifyAction(roomId);
      return true;
    }

    wizardSessionManager.saveGame(game);
    broadcastGameState(roomId, wizardGameService);
    wizardGameRunner.notifyAction(roomId);
    wizardGameRunner.run(roomId).catch((error) => {
      console.error(`[wizard] runner failed for room ${roomId}:`, error);
    });

    return false;
  };

  server.get("/lobby", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = request.user as { sub?: string | number };
    const userId = Number(user.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return reply.status(401).send({ error: "Invalid user" });
    }

    const username = getAuthenticatedUsername(request);

    const rooms = wizardLobbyManager.getRooms().filter((room) => {
      // A guest room shows only to those in it: its invite link is the one way
      // in. The host and their guests still see it, so their pages can call
      // them to the table once it starts (services/started-game.ts).
      if (room.inviteCode !== null) {
        return room.players.some((player) => player.username === username);
      }

      // Public rooms are visible to everyone authenticated.
      if (room.isPublic) {
        return true;
      }

      // The creator can always see their own room.
      if (room.createdBy === userId) {
        return true;
      }

      // Private rooms are visible to the creator's accepted friends.
      const creatorFriends = friendService.getFriends(room.createdBy);

      return creatorFriends.some((friend) => friend.playerId === userId);
    });

    return reply.send({ rooms: rooms.map(withQuitPlayers) });
  });

  // A single room, so the waiting room can poll without refetching the list.
    server.get(
      "/lobby/:roomId",
      {
        schema: {
          params: {
            type: "object",
            required: ["roomId"],
            additionalProperties: false,
            properties: {
              roomId: {
                type: "string",
                pattern: "^[1-9][0-9]*$"
              }
            }
          }
        }
      },
      async (request, reply) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const params = request.params as { roomId?: string };
        const roomId = Number(params.roomId);

        if (!Number.isInteger(roomId)) {
          return reply.status(400).send({ error: "Invalid room ID" });
        }

        const room = wizardLobbyManager.getRoomById(roomId);

        if (!room) {
          return reply.status(404).send({ error: "Room not found" });
        }

        const user = request.user as { sub?: string | number };
        const userId = Number(user.sub);
        const username = getAuthenticatedUsername(request);

        if (!Number.isInteger(userId) || userId <= 0 || !username) {
          return reply.status(401).send({ error: "Invalid user" });
        }

        const isMember = room.players.some(
          (player) => player.username === username
        );

        if (room.inviteCode !== null && !isMember) {
          return reply.status(403).send({
            error: "This is a guest room. Only its invite link leads in.",
          });
        }

        if (!room.isPublic && room.createdBy !== userId && !isMember) {
          const creatorFriends = friendService.getFriends(room.createdBy);

          const isFriend = creatorFriends.some(
            (friend) => friend.playerId === userId
          );

          if (!isFriend) {
            return reply.status(403).send({
              error: "This is a private room. Only the creator's friends can access it.",
            });
          }
        }

        return reply.send(withQuitPlayers(room));
      }
    );

  //add schema to no create games, false typeofs
  server.post(
      "/lobby/create",
      {
          schema: {
              body: {
                  type: "object",
                  required: ["name"],
                  additionalProperties: false,
                  properties: {
                      name: {
                          type: "string",
                          minLength: 1
                      },
                      maxPlayers: {
                          type: "integer",
                          minimum: 3,
                          maximum: 6
                      },
                      isPublic: {
                        type: "boolean",
                      },
                      // A guest room: hidden, joined by invite link only.
                      isGuestRoom: {
                        type: "boolean",
                      },
                      // Which game is played (modes/modes.ts); classic if left out.
                      mode: {
                        type: "string",
                        enum: [...GAME_MODES],
                      },
                      turnTimeoutMs: {
                        anyOf: [
                          {
                            type: "integer",
                            enum: [15000, 30000, 45000, 60000],
                          },
                          {
                            type: "null",
                          },
                        ],
                      },
                  }
              }
          }
      },
    async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as {
      name?: string;
      maxPlayers?: number;
      isPublic?: boolean;
      isGuestRoom?: boolean;
      turnTimeoutMs?: 15000 | 30000 | 45000 | 60000 | null;
      mode?: GameMode;
    };
    const tokenUser = request.user as {
      sub?: number;
      username?: string;
      guest?: boolean;
    };

    // Guests play at someone's table; they never host one.
    if (tokenUser.guest) {
      return reply.status(403).send({
        error: "Guests cannot open rooms",
      });
    }

    if (!body.name || body.name.trim() === "") {
      return reply.status(400).send({
        error: "Room name is required",
      });
    }

    if (!tokenUser.sub || !tokenUser.username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    const isGuestRoom = body.isGuestRoom === true;

    if (isGuestRoom && !guestRoomAllowed(Number(tokenUser.sub))) {
      return reply.status(429).send({
        error: `At most ${GUEST_ROOMS_PER_HOUR} guest rooms an hour`,
      });
    }

    const room = wizardLobbyManager.createRoom(
      body.name.trim(),
      Number(tokenUser.sub),
      tokenUser.username,
      body.maxPlayers,
      body.isPublic ?? true,
      body.turnTimeoutMs === undefined ? 30_000 : body.turnTimeoutMs,
      isGuestRoom,
      { ...DEFAULT_GAME_OPTIONS, mode: body.mode ?? "classic" },
    );

    return reply.send(room);
  });

  //added schema to not join false typeofs
  server.post(
    "/lobby/join",
    {
      schema: {
        body: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "integer",
              minimum: 1
            }
          }
        }
      }
    },
  async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { roomId?: number };
    const username = getAuthenticatedUsername(request);

    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }
    
    if (!body.roomId) {
      return reply.status(400).send({
        error: "roomId is required",
      });
    }

    const tokenUser = request.user as {
      sub?: string | number;
      username?: string;
    };

    const userId = Number(tokenUser.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      return reply.status(401).send({
        error: "Invalid user identity",
      });
    }

    const room = wizardLobbyManager.getRoomById(body.roomId);

    if (!room) {
      return reply.status(404).send({
        error: "Room not found",
      });
    }

    if (
      room.inviteCode !== null &&
      !room.players.some((player) => player.username === username)
    ) {
      return reply.status(403).send({
        error: "This is a guest room. Only its invite link leads in.",
      });
    }

    if (!room.isPublic && room.createdBy !== userId) {
      const creatorFriends = friendService.getFriends(room.createdBy);
      const isFriend = creatorFriends.some(
        (friend) => friend.playerId === userId,
      );

      if (!isFriend) {
        return reply.status(403).send({
          error: "This is a private room. Only the creator's friends can join.",
        });
      }
    }

    const result = wizardLobbyManager.joinRoom(body.roomId, username);

    if (!result.success) {
      if (result.reason === "not-found") {
        return reply.status(404).send({
          error: "Room not found",
        });
      }

      if (result.reason === "playing") {
        return reply.status(409).send({
          error: "Game already started",
        });
      }

      if (result.reason === "full") {
        return reply.status(409).send({
          error: "Room is full",
        });
      }

      return reply.status(401).send({
        error: "User not found",
      });
    }

    return reply.send(result.room);
  });

  // First come, first served: a second claim of the same avatar in a room is
  // rejected. Sending { avatar: null } releases the caller's current avatar.
  server.post(
    "/lobby/:roomId/avatar",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        },
        body: {
          type: "object",
          required: ["avatar"],
          additionalProperties: false,
          properties: {
            avatar: {
              anyOf: [
                {
                  type: "string",
                  enum: [...AVATAR_IDS]
                },
                {
                  type: "null"
                }
              ]
            }
          }
        }
      }
    },
  async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { roomId?: string };
    const body = (request.body ?? {}) as { avatar?: unknown };
    const roomId = Number(params.roomId);
    const username = getAuthenticatedUsername(request);

    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({ error: "Invalid room ID" });
    }

    const requested = body.avatar;
    const avatar =
      requested === null ? null : isAvatarId(requested) ? requested : undefined;

    if (avatar === undefined) {
      return reply.status(400).send({ error: "Unknown avatar" });
    }

    const room = wizardLobbyManager.getRoomById(roomId);

    if (!room) {
      return reply.status(404).send({ error: "Room not found" });
    }

    if (!room.players.some((player) => player.username === username)) {
      return reply.status(403).send({
        error: "You are not a member of this room",
      });
    }

    if (room.status !== "waiting") {
      return reply.status(409).send({
        error: "Avatars can only be changed before the game starts",
      });
    }

    if (!wizardLobbyManager.claimAvatar(roomId, username, avatar)) {
      return reply.status(409).send({ error: "That avatar is taken" });
    }

    return reply.send(wizardLobbyManager.getRoomById(roomId));
  });

  // A player's role in a Roles room, chosen while the room waits; null takes
  // it back. Everyone waiting sees it with the room.
  server.post(
    "/lobby/:roomId/role",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        },
        body: {
          type: "object",
          required: ["role"],
          additionalProperties: false,
          properties: {
            role: {
              anyOf: [
                { type: "string", enum: ROLES.map((role) => role.id) },
                { type: "null" }
              ]
            }
          }
        }
      }
    },
  async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const roomId = Number((request.params as { roomId: string }).roomId);
    const { role } = request.body as { role: RoleId | null };
    const username = getAuthenticatedUsername(request);
    const room = wizardLobbyManager.getRoomById(roomId);

    if (!username) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    if (!room) {
      return reply.status(404).send({ error: "Room not found" });
    }

    if (!room.players.some((player) => player.username === username)) {
      return reply.status(403).send({
        error: "You are not a member of this room",
      });
    }

    if (room.status !== "waiting") {
      return reply.status(409).send({
        error: "Roles can only be chosen before the game starts",
      });
    }

    wizardLobbyManager.chooseRole(roomId, username, role);

    return reply.send(wizardLobbyManager.getRoomById(roomId));
  });

  // The host's rule variations, saved as they choose them so everyone waiting
  // in the room can see them. The game starts with whatever is chosen then.
  server.post(
    "/lobby/:roomId/options",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        },
        body: {
          type: "object",
          required: ["wizardWins", "blindFirstRound"],
          additionalProperties: false,
          properties: {
            // Which game is played; left out, the room keeps its own.
            mode: {
              type: "string",
              enum: [...GAME_MODES]
            },
            wizardWins: {
              type: "string",
              enum: ["first", "last"]
            },
            blindFirstRound: {
              type: "boolean"
            },
            // Missed turns that count as leaving; null for never.
            missedTurnsToQuit: {
              anyOf: [
                { type: "integer", enum: [3, 5, 7, 9] },
                { type: "null" }
              ]
            },
            // The turn timeout (see turnTimeout.ts); null for no limit. Left
            // out, the room keeps the one it has.
            turnTimeoutMs: {
              anyOf: [
                { type: "integer", enum: [15000, 30000, 45000, 60000] },
                { type: "null" }
              ]
            }
          }
        }
      }
    },
  async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { roomId?: string };
    const roomId = Number(params.roomId);
    const userId = Number((request.user as { sub?: string | number }).sub);
    const room = wizardLobbyManager.getRoomById(roomId);

    if (!room) {
      return reply.status(404).send({ error: "Room not found" });
    }

    if (room.createdBy !== userId) {
      return reply.status(403).send({
        error: "Only the host can choose the rule variations",
      });
    }

    if (room.status !== "waiting") {
      return reply.status(409).send({
        error: "Rule variations can only be changed before the game starts",
      });
    }

    // Anything left out (an older page sends no mode) stays as the room has it.
    wizardLobbyManager.setRoomOptions(roomId, normalizeGameOptions(request.body, room.options));

    const body = request.body as { turnTimeoutMs?: unknown };
    if ("turnTimeoutMs" in body && isTurnTimeoutMs(body.turnTimeoutMs)) {
      wizardLobbyManager.setRoomTurnTimeout(roomId, body.turnTimeoutMs);
    }

    return reply.send(wizardLobbyManager.getRoomById(roomId));
  });

  server.delete("/lobby/:roomId", {
    schema: {
      params: {
        type: "object",
        required: ["roomId"],
        additionalProperties: false,
        properties: {
          roomId: {
            type: "string",
            pattern: "^[1-9][0-9]*$",
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { roomId?: string };
    const roomId = Number(params.roomId);
    const tokenUser = request.user as { sub?: number };

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({ error: "Invalid room ID" });
    }

    if (tokenUser.sub === undefined) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    const deleted = wizardLobbyManager.deleteWaitingRoom(
      roomId,
      Number(tokenUser.sub),
    );

    if (!deleted) {
      return reply.status(403).send({
        error: "Only the room creator can delete a waiting room",
      });
    }

    return reply.send({ success: true });
  });

  server.delete("/lobby/:roomId/leave", {
    schema: {
      params: {
        type: "object",
        required: ["roomId"],
        additionalProperties: false,
        properties: {
          roomId: {
            type: "string",
            pattern: "^[1-9][0-9]*$",
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { roomId?: string };
    const roomId = Number(params.roomId);
    const tokenUser = request.user as { sub?: number };

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({ error: "Invalid room ID" });
    }

    if (tokenUser.sub === undefined) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    const left = wizardLobbyManager.leaveRoom(
      roomId,
      Number(tokenUser.sub),
    );

    if (!left) {
      return reply.status(403).send({
        error: "You cannot leave this room",
      });
    }

    return reply.send({ success: true });
  });

  server.post("/guest-games", async (_request, reply) => {
    const guestUsername = `Guest-${randomUUID().slice(0, 8)}`;
    const guestEmail = `${guestUsername.toLowerCase()}@guest.invalid`;
    const guestPassword = randomUUID();

    try {
      const userResult = db
        .prepare(`
          INSERT INTO users (
            username,
            password_hash,
            display_name,
            email,
            is_guest
          )
          VALUES (?, ?, ?, ?, 1)
        `)
        .run(
          guestUsername,
          guestPassword,
          guestUsername,
          guestEmail,
        );

      const guestUserId = Number(userResult.lastInsertRowid);
      const room = wizardLobbyManager.createRoom(
        `${guestUsername}'s Table`,
        guestUserId,
        guestUsername,
        6,
      );

      const token = server.jwt.sign(
        {
          sub: guestUserId,
          username: guestUsername,
          guest: true,
        },
        { expiresIn: "2h" },
      );

      return reply.status(201).send({
        token,
        roomId: room.id,
        username: guestUsername,
      });
    } catch (error) {
      return reply.status(500).send({
        error:
          error instanceof Error
            ? error.message
            : "Could not create guest game",
      });
    }
  });

  // A guest leaving their table: the table, its game and the guest all go.
  server.delete("/guest-games", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const tokenUser = request.user as { sub?: string | number; username?: string };
    const userId = Number(tokenUser.sub);

    // An invited guest sits at someone else's table: a game already running
    // goes on without them, their seat played by the server.
    const seats = db
      .prepare(`
        SELECT room_id AS roomId
        FROM room_players
          JOIN users ON users.id = room_players.user_id
        WHERE room_players.user_id = ? AND users.is_guest = 1
      `)
      .all(userId) as { roomId: number }[];

    for (const { roomId } of seats) {
      const game = wizardSessionManager.getGame(roomId);
      const isActive =
        game && activeHumans(game).some((player) => player.username === tokenUser.username);

      if (isActive && tokenUser.username) {
        leaveGame(roomId, tokenUser.username);
      }
    }

    if (!Number.isInteger(userId) || !deleteGuest(userId)) {
      return reply.status(404).send({ error: "No guest game to leave" });
    }

    return reply.status(204).send();
  });

  // What an invite link leads to, for the page that asks the guest's name.
  // Open to anyone holding the link: it shows no more than the room's name,
  // its host, its seats and the game played there.
  server.get(
    "/invites/:code",
    { schema: { params: INVITE_CODE_PARAMS } },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const roomId = wizardLobbyManager.getRoomIdByInviteCode(code);
      const room = roomId === null ? null : wizardLobbyManager.getRoomById(roomId);

      if (!room) {
        return reply.status(404).send({
          error: "This invitation is no longer valid",
        });
      }

      return reply.send({
        roomId: room.id,
        roomName: room.name,
        hostName: room.createdByUsername,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        status: room.status,
        mode: room.options.mode,
      });
    },
  );

  // A guest taking a seat by invite link: a short-lived account under the
  // name they chose, seated at once. The room's free seats are the limit.
  server.post(
    "/invites/:code/guest",
    {
      schema: {
        params: INVITE_CODE_PARAMS,
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 40 },
          },
        },
      },
    },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const name = (request.body as { name: string }).name.trim().replace(/\s+/g, " ");

      if (!GUEST_NAME_PATTERN.test(name)) {
        return reply.status(400).send({
          error: "Names are 1-20 letters, digits or spaces",
        });
      }

      if (containsProfanity(name)) {
        return reply.status(400).send({
          error: "Please choose a different name",
        });
      }

      // " NPC" at the end of a name marks a bot.
      if (isBotName(name)) {
        return reply.status(400).send({
          error: "Names ending in NPC are reserved for computer players",
        });
      }

      const roomId = wizardLobbyManager.getRoomIdByInviteCode(code);
      const room = roomId === null ? null : wizardLobbyManager.getRoomById(roomId);

      if (!room) {
        return reply.status(404).send({
          error: "This invitation is no longer valid",
        });
      }

      if (room.status !== "waiting") {
        return reply.status(409).send({ error: "Game already started" });
      }

      if (room.players.length >= room.maxPlayers) {
        return reply.status(409).send({ error: "Room is full" });
      }

      const username = `Guest-${randomUUID().slice(0, 8)}-${name}`;
      const guestId = Number(
        db
          .prepare(`
            INSERT INTO users (username, password_hash, display_name, email, is_guest)
            VALUES (?, ?, ?, ?, 1)
          `)
          .run(
            username,
            randomUUID(),
            name,
            `${randomUUID()}@guest.invalid`,
          ).lastInsertRowid,
      );

      // Another guest may have taken the last seat in the meantime.
      const joined = wizardLobbyManager.joinRoom(room.id, username);

      if (!joined.success) {
        deleteGuest(guestId);
        return reply.status(409).send(
          joined.reason === "playing"
            ? { error: "Game already started" }
            : { error: "Room is full" },
        );
      }

      const token = server.jwt.sign(
        { sub: guestId, username, guest: true },
        { expiresIn: `${INVITED_GUEST_TOKEN_HOURS}h` },
      );

      return reply.status(201).send({ token, roomId: room.id, username });
    },
  );

  // A signed-up wizard following an invite link: they join as themselves.
  server.post(
    "/invites/:code/join",
    { schema: { params: INVITE_CODE_PARAMS } },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const tokenUser = request.user as { username?: string; guest?: boolean };

      if (!tokenUser.username || tokenUser.guest) {
        return reply.status(401).send({ error: "User identity missing" });
      }

      const { code } = request.params as { code: string };
      const roomId = wizardLobbyManager.getRoomIdByInviteCode(code);

      if (roomId === null) {
        return reply.status(404).send({
          error: "This invitation is no longer valid",
        });
      }

      const joined = wizardLobbyManager.joinRoom(roomId, tokenUser.username);

      if (!joined.success) {
        return reply.status(joined.reason === "not-found" ? 404 : 409).send(
          joined.reason === "playing"
            ? { error: "Game already started" }
            : joined.reason === "full"
              ? { error: "Room is full" }
              : { error: "This invitation is no longer valid" },
        );
      }

      return reply.send({ roomId });
    },
  );

  // The host's new invite link, for when the old one reached the wrong
  // people; the old one stops working.
  server.post(
    "/lobby/:roomId/invite",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: { type: "string", pattern: "^[1-9][0-9]*$" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const roomId = Number((request.params as { roomId: string }).roomId);
      const userId = Number((request.user as { sub?: string | number }).sub);
      const room = wizardLobbyManager.getRoomById(roomId);

      if (!room || room.inviteCode === null) {
        return reply.status(404).send({ error: "Room not found" });
      }

      if (room.createdBy !== userId) {
        return reply.status(403).send({ error: "Only the host can invite" });
      }

      return reply.send({ inviteCode: wizardLobbyManager.renewInviteCode(roomId) });
    },
  );

  server.post(
    "/games",
    {
      schema: {
        body: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "integer",
              minimum: 1
            },
            botCount: {
              type: "integer",
              minimum: 0
            },
            maxRounds: {
              type: "integer",
              minimum: 1
            },
            pace: {
              type: "number",
              exclusiveMinimum: 0
            },
            wizardWins: {
              type: "string",
              enum: ["first", "last"]
            },
            blindFirstRound: {
              type: "boolean"
            },
            // Missed turns that count as leaving; null for never.
            missedTurnsToQuit: {
              anyOf: [
                { type: "integer", enum: [3, 5, 7, 9] },
                { type: "null" }
              ]
            },
            botLevel: {
              type: "string",
              enum: BOT_LEVELS.map(({ level }) => level)
            }
          }
        }
      }
    },
    async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as CreateGameBody;
    const username = getAuthenticatedUsername(request);

    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    if (!body.roomId) {
      return reply.status(400).send({
        error: "roomId is required",
      });
    }
  
    const room = wizardLobbyManager.getRoomById(body.roomId);
    
    if (!room) {
      return reply.status(404).send({
        error: "Room not found",
      });
    }

    if (!room.players.some((player) => player.username === username)) {
      return reply.status(403).send({
        error: "You are not a member of this room",
      });
    }
    
    const botCount = body.botCount ?? 0;

    // One NPC more than the free seats means an all-NPC game: the host's seat
    // goes to "<host> NPC" and they watch. Only when the host is alone.
    const allNpcs = room.players.length === 1 && botCount === room.maxPlayers;

    if (
      !Number.isInteger(botCount) ||
      botCount < 0 ||
      (botCount > room.maxPlayers - room.players.length && !allNpcs)
    ) {
      return reply.status(400).send({
        error: "Invalid bot count",
      });
    }

    const totalPlayers = allNpcs ? botCount : room.players.length + botCount;

    if (totalPlayers < 3 || totalPlayers > 6) {
      return reply.status(400).send({
        error: "A Wizard game requires 3 to 6 players",
      });
    }

    const fullRounds = fullRoundCount(totalPlayers) ?? 0;
    const maxRounds = body.maxRounds ?? undefined;

    if (
      maxRounds !== undefined &&
      (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > fullRounds)
    ) {
      return reply.status(400).send({
        error: `Max rounds must be between 1 and ${fullRounds}`,
      });
    }

    // Avatars first, so each bot can be named to suit its avatar; the bots'
    // avatars then go to createGame as claims, so it keeps these assignments.
    // Bot slots are placeholders ending in " NPC", which no player can register.
    const humans = room.players.map((player) =>
      allNpcs ? `${player.username}${BOT_NAME_SUFFIX}` : player.username,
    );
    const claims = new Map<string, AvatarId | null>(
      room.players.map((player, index) => [humans[index]!, player.avatar]),
    );
    const botSlots = Array.from(
      { length: allNpcs ? botCount - 1 : botCount },
      (_, index) => `bot slot ${index} NPC`,
    );
    const avatars = assignAvatars([...humans, ...botSlots], claims);
    // Settle the humans' avatars here too: createGame sees them in the
    // shuffled seating below, where room order no longer breaks a tie.
    humans.forEach((name, index) => claims.set(name, avatars[index] ?? null));
    const botAvatars = avatars.slice(humans.length);
    const botNames = pickBotNames(botAvatars, humans);
    botNames.forEach((name, index) => claims.set(name, botAvatars[index] ?? null));
    // A random seating, so a random player leads the first round.
    const players = shuffledSeating([...humans, ...botNames]);

    try {
      const game = wizardGameService.createGame(
        room.id,
        players,
        claims,
        maxRounds,
        clampPace(body.pace),
        // What the start button sent, falling back to what the room saved.
        normalizeGameOptions({
          mode: room.options.mode,
          wizardWins: body.wizardWins ?? room.options.wizardWins,
          blindFirstRound: body.blindFirstRound ?? room.options.blindFirstRound,
          missedTurnsToQuit:
            body.missedTurnsToQuit !== undefined
              ? body.missedTurnsToQuit
              : room.options.missedTurnsToQuit,
        }),
        room.turnTimeoutMs,
      );
      assignBotPersonalities(game.players, normalizeBotLevel(body.botLevel));
      if (game.options?.mode === "roles") {
        assignRoles(
          game.players,
          new Map(room.players.map((player) => [player.username, player.role])),
        );
      }

      game.status = "playing";

      if (!wizardSessionManager.saveGameIfAbsent(game)) {
        return reply.status(409).send({
          error: "A game already exists for this room",
        });
      }

      const humanPlayerIds = db
        .prepare(`
          SELECT user_id AS userId
          FROM room_players
          WHERE room_id = ?
        `)
        .all(room.id) as { userId: number }[];

      // A guest room's games count for no one, so they are not even begun.
      if (room.inviteCode === null) {
        for (const { userId } of humanPlayerIds) {
          playerStatsRepository.initializeForUser(userId);
          playerStatsRepository.incrementGamesPlayed(userId);
        }

        playerStatsRepository.initializeForUser(room.createdBy);
        playerStatsRepository.incrementGamesCreated(room.createdBy);
      }

      wizardLobbyManager.setRoomStatus(room.id, "playing");

      void wizardGameRunner.run(room.id);

      return reply.status(201).send(
        wizardGameService.getPublicGameState(game, seatNameFor(username, game.players) ?? username),
      );
    } catch (error) {
      return reply.status(400).send({
        error:
          error instanceof Error
            ? error.message
            : "Could not create game",
      });
    }
  });
  
  server.get(
    "/games/:roomId",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        }
      }
    },
    async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    
    const params = request.params as { roomId?: string };
    const roomId = Number(params.roomId);
    const username = getAuthenticatedUsername(request);

    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    
    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({
        error: "Invalid room ID",
      });
    }
    
    const game = wizardSessionManager.getGame(roomId);
    
    if (!game) {
      return reply.status(404).send({
        error: "Game not found",
      });
    }
    
    // Watching an all-NPC game counts: the host sits as "<host> NPC".
    const seatName = seatNameFor(username, game.players);
    
    if (!seatName) {
      return reply.status(403).send({
        error: "You are not a player in this game",
      });
    }

    return reply.send(
      wizardGameService.getPublicGameState(game, seatName),
    );
  });
  
  server.post(
    "/games/:roomId/predictions",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        },
        body: {
          type: "object",
          required: ["prediction"],
          additionalProperties: false,
          properties: {
            prediction: {
              type: "integer",
              minimum: 0
            }
          }
        }
      }
    },
    async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    
    const params = request.params as { roomId?: string };
    const body = request.body as PredictionBody;
    const roomId = Number(params.roomId);
    const username = getAuthenticatedUsername(request);
    
    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({
        error: "Invalid room ID",
      });
    }
    
    const game = wizardSessionManager.getGame(roomId);
    
    if (!game) {
      return reply.status(404).send({
        error: "Game not found",
      });
    }
    
    if (hasQuit(game, username)) {
      return reply.status(403).send({
        error: "You have left this game",
      });
    }

    try {
      wizardGameService.submitPrediction(
        game,
        username,
        Number(body.prediction),
      );
      recordOwnMove(game, username);
      
      wizardSessionManager.saveGame(game);
      
      return reply.send(
        wizardGameService.getPublicGameState(game, username),
      );
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error
        ? error.message
        : "Could not submit prediction",
      });
    }
  });
  
  server.post(
    "/games/:roomId/cards",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        },
        body: {
          type: "object",
          required: ["cardIndex"],
          additionalProperties: false,
          properties: {
            cardIndex: {
              type: "integer",
              minimum: 0
            }
          }
        }
      }
    },
    async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const params = request.params as { roomId?: string };
    const body = request.body as PlayCardBody;
    const roomId = Number(params.roomId);
    const username = getAuthenticatedUsername(request);
    
    if (!username) {
      return reply.status(401).send({
        error: "User identity missing",
      });
    }

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({
        error: "Invalid room ID",
      });
    }

    const game = wizardSessionManager.getGame(roomId);

    if (!game) {
      return reply.status(404).send({
        error: "Game not found",
      });
    }
    
    const currentPlayer =
    game.players[game.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.username !== username) {
      return reply.status(403).send({
        error: "It is not your turn",
      });
    }

    if (hasQuit(game, username)) {
      return reply.status(403).send({
        error: "You have left this game",
      });
    }
    
    try {
      wizardGameService.playCard(
        game,
        Number(body.cardIndex),
      );
      recordOwnMove(game, username);
      
      wizardSessionManager.saveGame(game);
      
      return reply.send(
        wizardGameService.getPublicGameState(game, username),
      );
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error
        ? error.message
        : "Could not play card",
      });
    }
  });

  // Leaving a game for good: the server plays the seat from now on, and the
  // others go on without waiting (see playerQuit.ts). When the last human
  // quits, the game ends there, unfinished for everyone.
  server.post(
    "/games/:roomId/quit",
    {
      schema: {
        params: {
          type: "object",
          required: ["roomId"],
          additionalProperties: false,
          properties: {
            roomId: {
              type: "string",
              pattern: "^[1-9][0-9]*$"
            }
          }
        }
      }
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const roomId = Number((request.params as { roomId: string }).roomId);
      const username = getAuthenticatedUsername(request);

      if (!username) {
        return reply.status(401).send({ error: "User identity missing" });
      }

      const game = wizardSessionManager.getGame(roomId);

      if (!game) {
        return reply.status(404).send({ error: "Game not found" });
      }

      const isActiveHuman = activeHumans(game).some(
        (player) => player.username === username,
      );

      if (!isActiveHuman) {
        return reply.status(403).send({ error: "You are not playing in this game" });
      }

      return reply.send({ ended: leaveGame(roomId, username) });
    },
  );
}
