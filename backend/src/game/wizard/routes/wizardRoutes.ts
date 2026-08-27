import type { FastifyInstance } from "fastify";
import { wizardLobbyManager } from "../services/wizardLobbyManager.js";

export default async function wizardRoutes(server: FastifyInstance): Promise<void> {
  server.get("/lobby", async () => {
    return {
      rooms: wizardLobbyManager.getRooms(),
    };
  });

  server.post("/lobby/create", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { name?: string };
    const tokenUser = request.user as {
      sub?: number;
      username?: string;
    };

    if (!body.name || body.name.trim() === "") {
      return reply.status(400).send({ error: "Room name is required" });
    }

    if (!tokenUser.sub || !tokenUser.username) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    const room = wizardLobbyManager.createRoom(
      body.name.trim(),
      Number(tokenUser.sub),
      tokenUser.username,
    );

    return reply.send(room);
  });

  server.post("/lobby/join", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { roomId?: number };
    const tokenUser = request.user as { username?: string };

    if (!body.roomId) {
      return reply.status(400).send({ error: "roomId is required" });
    }

    if (!tokenUser.username) {
      return reply.status(401).send({ error: "User identity missing" });
    }

    const room = wizardLobbyManager.joinRoom(body.roomId, tokenUser.username);

    if (!room) {
      return reply.status(400).send({ error: "Could not join room" });
    }

    return reply.send(room);
  });
}