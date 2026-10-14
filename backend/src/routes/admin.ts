import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminService, isAdminUsername } from "../services/adminService.js";
import { UserService } from "../services/userService.js";

interface IdParams {
  id: string;
}

export default async function adminRoutes(
  server: FastifyInstance,
): Promise<void> {
  // Every admin route needs a signed-in account named in ADMIN_USERNAMES.
  // The name is read from the database, not the token, so an account renamed
  // or removed since it signed in loses access at once.
  server.addHook(
    "preHandler",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const userId = Number((request.user as { sub?: string | number }).sub);
      const user = Number.isInteger(userId)
        ? UserService.getUserById(userId)
        : null;

      if (!user || !isAdminUsername(user.username)) {
        return reply.status(403).send({ error: "Admins only" });
      }
    },
  );

  server.get("/rooms", async () => adminService.listRooms());

  server.get("/users", async () => adminService.listUsers());

  server.delete<{ Params: IdParams }>("/rooms/:id", async (request, reply) => {
    const roomId = Number(request.params.id);

    if (!adminService.deleteRoom(roomId)) {
      return reply.status(404).send({ error: "Room not found" });
    }

    return { deleted: roomId };
  });

  server.delete<{ Params: IdParams }>("/users/:id", async (request, reply) => {
    const userId = Number(request.params.id);
    const adminId = Number((request.user as { sub?: string | number }).sub);

    if (userId === adminId) {
      return reply.status(400).send({ error: "You cannot delete yourself" });
    }

    if (!adminService.deleteUser(userId)) {
      return reply.status(404).send({ error: "User not found" });
    }

    return { deleted: userId };
  });
}
