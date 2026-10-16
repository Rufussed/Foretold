import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { UserService } from "../services/userService.js";
import { isBotName } from "../game/wizard/models/bot.js";
import { playerStatsRepository } from "../game/wizard/services/playerStatsRepository.js";
import { playerOpponentRepository } from "../game/wizard/services/playerOpponentRepository.js";
import { friendService } from "../game/wizard/services/friendService.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
const DISPLAY_NAME_MAX_LENGTH = 30;

interface RegisterBody {
  username: string;
  password: string;
  displayName: string;
  email: string;
}

interface LoginBody {
  username: string;
  password: string;
}

export default async function authRoutes(
  server: FastifyInstance,
): Promise<void> {
  // Signing up and logging in both end with the same session token.
  function signSessionToken(user: { id: number; username: string }): string {
    return server.jwt.sign(
      {
        sub: user.id,
        username: user.username,
      },
      {
        expiresIn: "8h",
      },
    );
  }

  server.post<{ Body: RegisterBody }>(
    "/register",
    async (request, reply) => {
      const {
        username,
        password,
        displayName,
        email,
      } = request.body;

      if (!username || !password || !displayName || !email) {
        return reply.status(400).send({
          error: "All fields are required",
        });
      }

      // Names are shown on other players' screens, so they are kept to plain
      // characters. Existing accounts are not affected.
      if (!USERNAME_PATTERN.test(username)) {
        return reply.status(400).send({
          error:
            "Username must be 3-20 letters, numbers, _ or -",
        });
      }

      if (displayName.trim().length > DISPLAY_NAME_MAX_LENGTH) {
        return reply.status(400).send({
          error: `Display name can be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
        });
      }

      // " NPC" at the end of a name marks a bot.
      if (isBotName(username.trim())) {
        return reply.status(400).send({
          error: "Usernames ending in NPC are reserved for computer players",
        });
      }

      if (password.length < 8) {
        return reply.status(400).send({
          error: "Password must contain at least 8 characters",
        });
      }

      const existingUser = UserService.getUserByUsername(username);

      if (existingUser) {
        return reply.status(409).send({
          error: "Username is already in use",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      try {
        const user = UserService.createUser(
          username,
          passwordHash,
          displayName,
          email,
        );

        playerStatsRepository.initializeForUser(user.id);

        return reply.status(201).send({
          token: signSessionToken(user),
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            createdAt: user.createdAt,
          },
        });
      } catch (error) {
        server.log.error(error);

        return reply.status(500).send({
          error: "Could not create user",
        });
      }
    },
  );
	server.post<{ Body: LoginBody }>(
	"/login",
	async (request, reply) => {
		const { username, password } = request.body;

		if (!username || !password) {
		return reply.status(400).send({
			error: "Username and password are required",
		});
		}

		const user = UserService.getUserByUsername(username);

		if (!user) {
		return reply.status(401).send({
			error: "Invalid username or password",
		});
		}

		const passwordMatches = await bcrypt.compare(
		password,
		user.passwordHash,
		);

		if (!passwordMatches) {
		return reply.status(401).send({
			error: "Invalid username or password",
		});
		}

		const token = signSessionToken(user);

		return reply.send({
		token,
		user: {
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			email: user.email,
		},
		});
	},
	);
		server.get("/me", async (request, reply) => {
		try {
		await request.jwtVerify();

		const tokenUser = request.user as {
			sub: number;
			username: string;
		};

		const user = UserService.getUserById(tokenUser.sub);

		if (!user) {
			return reply.status(404).send({
			error: "User not found",
			});
		}

		return reply.send({
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			email: user.email,
			createdAt: user.createdAt,
		});
		} catch {
		return reply.status(401).send({
			error: "Invalid or missing token",
		});
		}
	});

  server.get("/search", async (request, reply) => {
    try {
      await request.jwtVerify();

      const query = request.query as { query?: string };
      const tokenUser = request.user as { sub?: number };
      const searchQuery = query.query?.trim() ?? "";

      if (tokenUser.sub === undefined) {
        return reply.status(401).send({
          error: "User identity missing",
        });
      }

      if (searchQuery.length < 2) {
        return reply.send([]);
      }

      return reply.send(
        UserService.searchUsers(searchQuery, Number(tokenUser.sub)),
      );
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

	  server.get("/me/stats", async (request, reply) => {
    try {
      await request.jwtVerify();

      const tokenUser = request.user as {
        sub: number;
        username: string;
      };

      const stats = playerStatsRepository.getStats(tokenUser.sub);

      if (!stats) {
        return reply.status(404).send({
          error: "Player stats not found",
        });
      }

      return reply.send(stats);
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

  server.get("/me/opponents", async (request, reply) => {
    try {
      await request.jwtVerify();

      const tokenUser = request.user as {
        sub: number;
        username: string;
      };

      const opponents = playerOpponentRepository.getOpponents(tokenUser.sub);

      return reply.send(opponents);
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

    server.get("/player/:userId/profile", async (request, reply) => {
    try {
      await request.jwtVerify();

      const params = request.params as {
        userId?: string;
      };

      const userId = Number(params.userId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const user = UserService.getUserById(userId);

      if (!user) {
        return reply.status(404).send({
          error: "Player not found",
        });
      }

      const stats = playerStatsRepository.getStats(userId);

      if (!stats) {
        return reply.status(404).send({
          error: "Player stats not found",
        });
      }

      const opponents = playerOpponentRepository.getOpponents(userId);

      return reply.send({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        stats,
        opponents,
      });
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

  server.post("/friends/request/:userId", async (request, reply) => {
    try {
      await request.jwtVerify();

      const params = request.params as {
        userId?: string;
      };

      const receiverId = Number(params.userId);

      if (!Number.isInteger(receiverId) || receiverId <= 0) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const tokenUser = request.user as {
        sub?: number;
      };

      if (tokenUser.sub === undefined) {
        return reply.status(401).send({
          error: "User identity missing",
        });
      }

      const sent = friendService.sendRequest(
        Number(tokenUser.sub),
        receiverId,
      );

      if (!sent) {
        return reply.status(400).send({
          error: "Could not send friend request",
        });
      }

      return reply.send({
        success: true,
      });
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

  server.get("/friends/requests", async (request, reply) => {
    try {
      await request.jwtVerify();

      const tokenUser = request.user as {
        sub?: number;
      };

      if (tokenUser.sub === undefined) {
        return reply.status(401).send({
          error: "User identity missing",
        });
      }

      const requests = friendService.getPendingRequests(
        Number(tokenUser.sub),
      );

      return reply.send(requests);
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });
  
  server.get("/friends", async (request, reply) => {
    try {
      await request.jwtVerify();

      const tokenUser = request.user as {
        sub?: number;
      };

      if (tokenUser.sub === undefined) {
        return reply.status(401).send({
          error: "User identity missing",
        });
      }

      const friends = friendService.getFriends(
        Number(tokenUser.sub),
      );

      return reply.send(friends);
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

  server.post(
    "/friends/requests/:requestId/accept",
    async (request, reply) => {
      try {
        await request.jwtVerify();

        const params = request.params as {
          requestId?: string;
        };

        const requestId = Number(params.requestId);

        if (!Number.isInteger(requestId) || requestId <= 0) {
          return reply.status(400).send({
            error: "Invalid request ID",
          });
        }

        const tokenUser = request.user as {
          sub?: number;
        };

        if (tokenUser.sub === undefined) {
          return reply.status(401).send({
            error: "User identity missing",
          });
        }

        const accepted = friendService.acceptRequest(
          requestId,
          Number(tokenUser.sub),
        );

        if (!accepted) {
          return reply.status(400).send({
            error: "Could not accept friend request",
          });
        }

        return reply.send({
          success: true,
        });
      } catch {
        return reply.status(401).send({
          error: "Invalid or missing token",
        });
      }
    },
  );

  server.post(
    "/friends/requests/:requestId/reject",
    async (request, reply) => {
      try {
        await request.jwtVerify();

        const params = request.params as {
          requestId?: string;
        };

        const requestId = Number(params.requestId);

        if (!Number.isInteger(requestId) || requestId <= 0) {
          return reply.status(400).send({
            error: "Invalid request ID",
          });
        }

        const tokenUser = request.user as {
          sub?: number;
        };

        if (tokenUser.sub === undefined) {
          return reply.status(401).send({
            error: "User identity missing",
          });
        }

        const rejected = friendService.rejectRequest(
          requestId,
          Number(tokenUser.sub),
        );

        if (!rejected) {
          return reply.status(400).send({
            error: "Could not reject friend request",
          });
        }

        return reply.send({
          success: true,
        });
      } catch {
        return reply.status(401).send({
          error: "Invalid or missing token",
        });
      }
    },
  );

  server.delete("/friends/:userId", async (request, reply) => {
    try {
      await request.jwtVerify();

      const params = request.params as {
        userId?: string;
      };

      const friendId = Number(params.userId);

      if (!Number.isInteger(friendId) || friendId <= 0) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      const tokenUser = request.user as {
        sub?: number;
      };

      if (tokenUser.sub === undefined) {
        return reply.status(401).send({
          error: "User identity missing",
        });
      }

      const removed = friendService.removeFriend(
        Number(tokenUser.sub),
        friendId,
      );

      if (!removed) {
        return reply.status(404).send({
          error: "Friendship not found",
        });
      }

      return reply.send({
        success: true,
      });
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });

  server.get("/friends/status/:userId", async (request, reply) => {
    try {
      await request.jwtVerify();

      const params = request.params as { userId?: string };
      const otherUserId = Number(params.userId);
      const tokenUser = request.user as { sub?: number };

      if (
        !Number.isInteger(otherUserId) ||
        otherUserId <= 0 ||
        tokenUser.sub === undefined
      ) {
        return reply.status(400).send({
          error: "Invalid user ID",
        });
      }

      return reply.send(
        friendService.getRelationshipStatus(
          Number(tokenUser.sub),
          otherUserId,
        ),
      );
    } catch {
      return reply.status(401).send({
        error: "Invalid or missing token",
      });
    }
  });
}

