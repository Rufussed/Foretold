import Fastify from "fastify";
import cors from "@fastify/cors";
import db from "./db/database.js";
import authRoutes from "./routes/auth.js";
import jwt from "@fastify/jwt";
import wizardRoutes from "./game/wizard/routes/wizardRoutes.js";
import websocket from "@fastify/websocket";
import { wizardLobbyManager } from "./game/wizard/services/wizardLobbyManager.js";


const server = Fastify({
  logger: true,
});


server.get("/health", async () => {
  return {
    status: "ok",
    message: "Wizard backend is running",
  };
});

server.get("/health/database", async () => {
  const result = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
  )
  .get("users") as { name: string } | undefined;
  
  return {
    status: result ? "ok" : "error",
    usersTableExists: Boolean(result),
  };
});


await server.register(cors, {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await server.register(websocket);

await server.register(jwt, {
  secret: process.env.JWT_SECRET || "development-secret-change-me",
});

await server.register(authRoutes, {
  prefix: "/users",
});

await server.register(wizardRoutes, {
  prefix: "/wizard",
});

wizardLobbyManager.resetPlayingRooms();

try {
  await server.listen({
    port: 3000,
    host: "127.0.0.1",
  });

  console.log("Wizard backend running at http://localhost:3000");
} catch (error) {
  server.log.error(error);
  process.exit(1);
}