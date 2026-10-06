import type { FastifyInstance } from "fastify";
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
import db from "../../../db/database.js";
import { playerStatsRepository } from "../services/playerStatsRepository.js";

interface CreateGameBody {
  roomId?: number;
  botCount?: number;
  // Optional cap for a shorter game, 1 up to a full game's rounds.
  maxRounds?: number;
  // How fast the game plays out, chosen in room setup. Out-of-range values are
  // clamped rather than refused, so a stale client cannot fail to start a game.
  pace?: number;
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

  server.get("/lobby", async () => {
    return {
      rooms: wizardLobbyManager.getRooms(),
    };
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
    const params = request.params as { roomId?: string };
    const roomId = Number(params.roomId);

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({ error: "Invalid room ID" });
    }

    const room = wizardLobbyManager.getRoomById(roomId);

    if (!room) {
      return reply.status(404).send({ error: "Room not found" });
    }

    return reply.send(room);
  });

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

    const body = request.body as {
      name?: string;
      maxPlayers?: number;
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

  /*
 * DEVELOPMENT ONLY:
 * Room deletion is intentionally available to any authenticated user.
 *
 * BEFORE PRODUCTION:
 * Verify that request.user.sub is authorized to delete this room.
 * At minimum, compare it with rooms.created_by.
 *
 * Do NOT leave this endpoint unrestricted in production.
 */
  server.delete(
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

    const tokenUser = request.user as {
      sub?: number;
    };

    if (!Number.isInteger(roomId)) {
      return reply.status(400).send({ error: "Invalid room ID" });
    }

    if (tokenUser.sub === undefined) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    //we need so that only the created can delete the game
    // const deleted = wizardLobbyManager.deleteRoom(
    //   roomId,
    //   Number(tokenUser.sub),
    // );

    // DEVELOPMENT ONLY - REMOVE/RESTRICT BEFORE PRODUCTION
    const deleted = wizardLobbyManager.deleteRoom(roomId);

    if (!deleted) {
      return reply.status(403).send({
        error: "Room cannot be deleted",
      });
    }

    return reply.send({ success: true });
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