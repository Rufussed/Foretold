import type { FastifyInstance } from "fastify";
import { wizardGameManager } from "../services/wizardGameManager.js";

export default async function wizardRoutes(server: FastifyInstance): Promise<void> {
  server.get("/lobby", async () => {
    return {
      rooms: wizardGameManager.getRooms(),
    };
  });

  server.post("/lobby/create", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { name?: string };

    if (!body.name || body.name.trim() === "") {
      return reply.status(400).send({ error: "Room name is required" });
    }

    const room = wizardGameManager.createRoom(body.name.trim());

    return reply.send(room);
  });

  server.post("/lobby/join", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const body = request.body as { roomId?: string; username?: string };

    if (!body.roomId || !body.username) {
      return reply.status(400).send({ error: "roomId and username are required" });
    }

    const room = wizardGameManager.joinRoom(body.roomId, body.username);

    if (!room) {
      return reply.status(400).send({ error: "Could not join room" });
    }

    return reply.send(room);
  });
}