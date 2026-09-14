import bcrypt from "bcrypt";
import type { FastifyInstance } from "fastify";
import { UserService } from "../services/userService.js";
import { isBotName } from "../game/wizard/models/bot.js";

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

        return reply.status(201).send({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          createdAt: user.createdAt,
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

		const token = server.jwt.sign(
		{
			sub: user.id,
			username: user.username,
		},
		{
			expiresIn: "8h",
		},
		);

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
}

