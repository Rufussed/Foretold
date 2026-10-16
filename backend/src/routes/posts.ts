import type { FastifyInstance, FastifyRequest } from "fastify";
import { isAdminUsername } from "../services/adminService.js";
import {
  POST_MAX_LENGTH,
  PostError,
  postService,
} from "../services/postService.js";
import { UserService, type User } from "../services/userService.js";

interface ListQuery {
  before?: string;
}

interface CreateBody {
  text: string;
}

interface IdParams {
  id: string;
}

// The signed-in account behind a request, read from the database so a
// deleted or renamed account is not trusted from an old token. Null when
// there is no valid token.
async function requestUser(request: FastifyRequest): Promise<User | null> {
  try {
    await request.jwtVerify();
  } catch {
    return null;
  }

  const userId = Number((request.user as { sub?: string | number }).sub);
  return Number.isInteger(userId) ? UserService.getUserById(userId) : null;
}

// Anyone may read the board; posting and deleting need an account.
export default async function postRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get<{ Querystring: ListQuery }>("/", async (request, reply) => {
    const before =
      request.query.before === undefined ? undefined : Number(request.query.before);

    if (before !== undefined && !Number.isInteger(before)) {
      return reply.status(400).send({ error: "Invalid page" });
    }

    // Without a token the list is the same, just with no delete buttons.
    const user = request.headers.authorization ? await requestUser(request) : null;
    const isAdmin = user ? isAdminUsername(user.username) : false;
    const { posts, hasMore } = postService.list(before);

    return {
      posts: posts.map((post) => ({
        id: post.id,
        username: post.username,
        displayName: post.displayName,
        text: post.text,
        createdAt: post.createdAt,
        canDelete: isAdmin || post.userId === user?.id,
      })),
      hasMore,
    };
  });

  server.post<{ Body: CreateBody }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["text"],
          additionalProperties: false,
          properties: {
            // Room for surrounding spaces, which are trimmed before the
            // real limit is checked.
            text: { type: "string", maxLength: POST_MAX_LENGTH * 2 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = await requestUser(request);

      if (!user) {
        return reply.status(401).send({ error: "Log in to post" });
      }

      if (postService.isGuest(user.id)) {
        return reply.status(403).send({ error: "Sign up to post on the board" });
      }

      try {
        const post = postService.create(user.id, request.body.text);

        return reply.status(201).send({
          id: post.id,
          username: post.username,
          displayName: post.displayName,
          text: post.text,
          createdAt: post.createdAt,
          canDelete: true,
        });
      } catch (error) {
        if (error instanceof PostError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // The author can take their own post down, and admins any post.
  server.delete<{ Params: IdParams }>("/:id", async (request, reply) => {
    const user = await requestUser(request);

    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const postId = Number(request.params.id);
    const authorId = Number.isInteger(postId) ? postService.getAuthorId(postId) : null;

    if (authorId === null) {
      return reply.status(404).send({ error: "Post not found" });
    }

    if (authorId !== user.id && !isAdminUsername(user.username)) {
      return reply.status(403).send({ error: "You can only delete your own posts" });
    }

    postService.delete(postId);
    return { deleted: postId };
  });
}
