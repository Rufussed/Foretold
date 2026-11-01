import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isRoleId } from "./roles.js";
import { devAddRoleGame, devResetRole, getRoleProgress } from "./roleProgress.js";

// Roles mode only. The Profile's seals (src/modes/roles/profile-seals.ts),
// under /roles (server.ts):
//
//   GET  /roles/progress/me        your record with each role
//   GET  /roles/progress/:userId   another player's
//   POST /roles/progress/dev       { role, won?, reset? }  WIZARD_DEV_TOOLS only:
//                                  one more game with a role, or its record wiped

// The signed-in player's id, or null after answering 401.
async function signedIn(request: FastifyRequest, reply: FastifyReply): Promise<number | null> {
  try {
    await request.jwtVerify();
    return (request.user as { sub: number }).sub;
  } catch {
    await reply.status(401).send({ error: "Invalid or missing token" });
    return null;
  }
}

export default async function roleProgressRoutes(server: FastifyInstance): Promise<void> {
  server.get("/progress/me", async (request, reply) => {
    const userId = await signedIn(request, reply);
    if (userId === null) return reply;
    return reply.send(getRoleProgress(userId));
  });

  server.get("/progress/:userId", async (request, reply) => {
    if ((await signedIn(request, reply)) === null) return reply;
    const userId = Number((request.params as { userId?: string }).userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return reply.status(400).send({ error: "Invalid user ID" });
    }
    return reply.send(getRoleProgress(userId));
  });

  server.post("/progress/dev", async (request, reply) => {
    if (!process.env.WIZARD_DEV_TOOLS) {
      return reply.status(404).send({ error: "Not found" });
    }
    const userId = await signedIn(request, reply);
    if (userId === null) return reply;
    const body = (request.body ?? {}) as { role?: unknown; won?: unknown; reset?: unknown };
    if (!isRoleId(body.role)) {
      return reply.status(400).send({ error: "[dev] Unknown role" });
    }
    if (body.reset === true) devResetRole(userId, body.role);
    else devAddRoleGame(userId, body.role, body.won === true);
    return reply.send(getRoleProgress(userId));
  });
}
