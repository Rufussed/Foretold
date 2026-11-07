import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { UserService } from "../services/userService.js";
import { isBotName } from "../game/wizard/models/bot.js";
import { playerStatsRepository } from "../game/wizard/services/playerStatsRepository.js";
import { playerOpponentRepository } from "../game/wizard/services/playerOpponentRepository.js";
import { friendService } from "../game/wizard/services/friendService.js";
import { containsProfanity } from "../services/profanityFilter.js";
import { emailTokenService, type EmailTokenPurpose } from "../services/emailTokenService.js";
import { mailLanguage, mailService, type MailLanguage } from "../services/mailService.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
// Something@something.something: enough to catch a typo, and the mailed link
// proves the rest.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The shortest wait between two mails of one kind to one player.
const MAIL_COOLDOWN_SECONDS = 60;

interface RegisterBody {
  username: string;
  password: string;
  email: string;
  // The page's language, for the mail's: "en" or "de".
  language?: string;
}

interface LoginBody {
  username: string;
  password: string;
}

// The login field of a mail request: the wizard name or the email.
interface MailRequestBody {
  login?: string;
  language?: string;
}

interface TokenBody {
  token?: string;
  password?: string;
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

  function sessionReply(user: { id: number; username: string; displayName: string; email: string }) {
    return {
      token: signSessionToken(user),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
      },
    };
  }

  // Mails the player a new link, without waiting for the mail server: the
  // reply is the same whether or not an account was found, and a mail server
  // that fails is the log's business, not the player's.
  function mailLink(
    user: { id: number; username: string; email: string },
    purpose: EmailTokenPurpose,
    language: MailLanguage,
  ): void {
    const token = emailTokenService.create(user.id, purpose);
    const sending =
      purpose === "verify"
        ? mailService.sendVerification(user, token, language)
        : mailService.sendPasswordReset(user, token, language);

    sending.catch((error: unknown) => {
      server.log.error({ err: error, userId: user.id, purpose }, "could not send mail");
    });
  }

  // The account a mail request names, if it may be sent one. Guests have no
  // real address.
  function mailRecipient(body: MailRequestBody | undefined, purpose: EmailTokenPurpose) {
    const login = String(body?.login ?? "").trim();
    if (!login) return null;

    const user = login.includes("@")
      ? UserService.getUserByEmail(login)
      : UserService.getUserByUsername(login);

    if (!user || /^guest-/i.test(user.username)) return null;

    const since = emailTokenService.secondsSinceLast(user.id, purpose);
    if (since !== null && since < MAIL_COOLDOWN_SECONDS) return null;

    return user;
  }

  // The confirmation mail again, for a player whose link was lost or expired.
  // Always the same reply, so it cannot be used to find out who has an account.
  server.post<{ Body: MailRequestBody }>("/resend-verification", async (request, reply) => {
    const user = mailRecipient(request.body, "verify");

    if (user && !user.emailVerified) {
      mailLink(user, "verify", mailLanguage(request.body?.language));
    }

    return reply.send({ ok: true });
  });

  // The confirmation link: the address is confirmed and the player signed in.
  server.post<{ Body: TokenBody }>("/verify-email", async (request, reply) => {
    const userId = emailTokenService.consume(String(request.body?.token ?? ""), "verify");
    const user = userId === null ? null : UserService.getUserById(userId);

    if (!user) {
      return reply.status(400).send({
        error: "This link is invalid or has expired",
      });
    }

    UserService.markEmailVerified(user.id);

    return reply.send(sessionReply(user));
  });

  // "Forgot password": a link to choose a new one. The same reply whether or
  // not the account exists.
  server.post<{ Body: MailRequestBody }>("/forgot-password", async (request, reply) => {
    const user = mailRecipient(request.body, "reset");

    if (user) {
      mailLink(user, "reset", mailLanguage(request.body?.language));
    }

    return reply.send({ ok: true });
  });

  // The reset link with the new password. Following it also proves the
  // address, so an unconfirmed account is confirmed too, and signed in.
  server.post<{ Body: TokenBody }>("/reset-password", async (request, reply) => {
    const password = String(request.body?.password ?? "");

    if (password.length < 8) {
      return reply.status(400).send({
        error: "Password must contain at least 8 characters",
      });
    }

    const userId = emailTokenService.consume(String(request.body?.token ?? ""), "reset");
    const user = userId === null ? null : UserService.getUserById(userId);

    if (!user) {
      return reply.status(400).send({
        error: "This link is invalid or has expired",
      });
    }

    UserService.setPasswordHash(user.id, await bcrypt.hash(password, 10));
    UserService.markEmailVerified(user.id);

    return reply.send(sessionReply(user));
  });

  server.post<{ Body: RegisterBody }>(
    "/register",
    async (request, reply) => {
      const { username, password, email } = request.body;

      if (!username || !password || !email) {
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

      if (containsProfanity(username)) {
        return reply.status(400).send({
          error: "Please choose a different username",
        });
      }

      // Guests' generated names start with "Guest-", and every page shows
      // such a name as a guest's (the frontend's utils/display-name.ts).
      if (/^guest-/i.test(username)) {
        return reply.status(400).send({
          error: "Usernames starting with Guest- are reserved for guests",
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

      if (UserService.isUsernameTaken(username)) {
        return reply.status(409).send({
          error: "Username is already in use",
        });
      }

      const trimmedEmail = email.trim();

      if (trimmedEmail.length > 254 || !EMAIL_PATTERN.test(trimmedEmail)) {
        return reply.status(400).send({
          error: "Please enter a valid email",
        });
      }

      if (UserService.isEmailTaken(trimmedEmail)) {
        return reply.status(409).send({
          error: "Email is already in use",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      try {
        const user = UserService.createUser(username, passwordHash, trimmedEmail);

        playerStatsRepository.initializeForUser(user.id);

        // No session yet: the account opens once the mailed link is followed
        // (POST /verify-email). A mail that fails can be asked for again
        // from the login form.
        mailLink(user, "verify", mailLanguage(request.body.language));

        return reply.status(201).send({
          email: user.email,
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

		// The login field takes the wizard name or the email. Names cannot
		// contain "@", so an "@" means an email.
		const user = username.includes("@")
		? UserService.getUserByEmail(username.trim())
		: UserService.getUserByUsername(username);

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

		// Only after the password, so this says nothing to a stranger.
		if (!user.emailVerified) {
		return reply.status(403).send({
			error: "Please confirm your email first",
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

