import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { BOT_NAME_SUFFIX, seatNameFor } from "../models/bot.js";
import { pickBotNames } from "../botNames.js";
import { wizardLobbyManager } from "../services/wizardLobbyManager.js";
import { assignAvatars, WizardGameService } from "../services/wizardGameService.js";
import { wizardSessionManager } from "../services/wizardSessionManager.js";
import { registerWizardSocket } from "../websocket/wizardSocket.js";
import { WizardGameRunner } from "../services/wizardGameRunner.js";
import { AVATAR_IDS, isAvatarId, type AvatarId } from "../models/avatar.js";
import { fullRoundCount } from "../models/rounds.js";
import { clampPace } from "../gameplayPace.js";
import { normalizeGameOptions } from "../gameOptions.js";
import db from "../../../db/database.js";
import { playerStatsRepository } from "../services/playerStatsRepository.js";
import { friendService } from "../services/friendService.js";
import { deleteGuest } from "../services/guestCleanup.js";

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
}

interface PredictionBody {
  prediction?: number;
}

interface PlayCardBody {
  cardIndex?: number;
}

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

    const rooms = wizardLobbyManager.getRooms().filter((room) => {
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

    return reply.send({ rooms });
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

        return reply.send(room);
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
    };
    const tokenUser = request.user as {
      sub?: number;
      username?: string;
    };

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

    const room = wizardLobbyManager.createRoom(
      body.name.trim(),
      Number(tokenUser.sub),
      tokenUser.username,
      body.maxPlayers,
      body.isPublic ?? true,
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
            wizardWins: {
              type: "string",
              enum: ["first", "last"]
            },
            blindFirstRound: {
              type: "boolean"
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

    wizardLobbyManager.setRoomOptions(roomId, normalizeGameOptions(request.body));

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

    const userId = Number((request.user as { sub?: string | number }).sub);

    if (!Number.isInteger(userId) || !deleteGuest(userId)) {
      return reply.status(404).send({ error: "No guest game to leave" });
    }

    return reply.status(204).send();
  });

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
    const botAvatars = avatars.slice(humans.length);
    const botNames = pickBotNames(botAvatars, humans);
    botNames.forEach((name, index) => claims.set(name, botAvatars[index] ?? null));
    const players = [...humans, ...botNames];

    try {
      const game = wizardGameService.createGame(
        room.id,
        players,
        claims,
        maxRounds,
        clampPace(body.pace),
        // What the start button sent, falling back to what the room saved.
        normalizeGameOptions({
          wizardWins: body.wizardWins ?? room.options.wizardWins,
          blindFirstRound: body.blindFirstRound ?? room.options.blindFirstRound,
        }),
      );

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

      for (const { userId } of humanPlayerIds) {
        playerStatsRepository.initializeForUser(userId);
        playerStatsRepository.incrementGamesPlayed(userId);
      }

      playerStatsRepository.initializeForUser(room.createdBy);
      playerStatsRepository.incrementGamesCreated(room.createdBy);

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
    
    try {
      wizardGameService.submitPrediction(
        game,
        username,
        Number(body.prediction),
      );
      
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
    
    try {
      wizardGameService.playCard(
        game,
        Number(body.cardIndex),
      );
      
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
}