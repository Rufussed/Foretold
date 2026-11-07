import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminService, isAdminUsername } from "../services/adminService.js";
import { UserService } from "../services/userService.js";
import db from "../db/database.js";
import { EMAIL_PATTERN } from "./auth.js";
import { setRolesAllOpen } from "../game/wizard/modes/roles/roleAccess.js";

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

  // Roles mode: every role open for an account, or the locks back on
  // (modes/roles/roleAccess.ts).
  server.post<{ Params: IdParams; Body: { open?: unknown } }>("/users/:id/roles-open", async (request, reply) => {
    const userId = Number(request.params.id);
    if (!Number.isInteger(userId) || !UserService.getUserById(userId)) {
      return reply.status(404).send({ error: "User not found" });
    }
    const open = request.body?.open === true;
    setRolesAllOpen(userId, open);
    return { userId, rolesOpen: open };
  });

  // Confirms an account's email by hand, for players whose address is wrong
  // or never gets the mail: they can sign in at once.
  server.post<{ Params: IdParams }>("/users/:id/confirm-email", async (request, reply) => {
    const userId = Number(request.params.id);
    if (!Number.isInteger(userId) || !UserService.getUserById(userId)) {
      return reply.status(404).send({ error: "User not found" });
    }
    UserService.markEmailVerified(userId);
    return { userId, emailVerified: true };
  });

  // The same for every account still waiting, guests aside.
  server.post("/users/confirm-all", async () => {
    const result = db.prepare("UPDATE users SET email_verified = 1 WHERE email_verified = 0 AND is_guest = 0").run();
    return { confirmed: Number(result.changes) };
  });

  // Sets an account's email to a new address, confirmed at once, for a player
  // who signed up with a wrong one. No mail is sent.
  server.post<{ Params: IdParams; Body: { email?: unknown } }>("/users/:id/email", async (request, reply) => {
    const userId = Number(request.params.id);
    const user = Number.isInteger(userId) ? UserService.getUserById(userId) : null;
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    const email = typeof request.body?.email === "string" ? request.body.email.trim() : "";
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return reply.status(400).send({ error: "Please enter a valid email" });
    }
    const owner = UserService.getUserByEmail(email);
    if (owner && owner.id !== userId) {
      return reply.status(409).send({ error: `That email belongs to ${owner.username}` });
    }
    UserService.setConfirmedEmail(userId, email);
    return { userId, email };
  });
}
