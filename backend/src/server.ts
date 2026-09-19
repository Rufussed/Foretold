import Fastify from "fastify";
import cors from "@fastify/cors";
import db from "./db/database.js";
import { seedUsers } from "./db/seedUsers.js";
import authRoutes from "./routes/auth.js";
import jwt from "@fastify/jwt";
import wizardRoutes from "./game/wizard/routes/wizardRoutes.js";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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


// Where the server listens. Hosting providers pass the port in PORT; locally
// it stays on 3000, which the dev frontend expects (src/services/api.ts).
const port = Number(process.env.PORT) || 3000;
// Where the server listens, and which frontend pages may call it. Both default
// to this computer only; `npm run play` (scripts/play.mjs) sets them for
// playing from other devices on your Wi-Fi or over Tailscale.
// With PORT set (a hosting provider) listen publicly; otherwise this computer only.
const host = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

await server.register(cors, {
  origin: corsOrigins,
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

// In production the built frontend (npm run build -> dist/) is served from
// this same server, so the page, API and WebSocket share one origin.
const frontendDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dist",
);
if (existsSync(frontendDist)) {
  await server.register(fastifyStatic, {
    root: frontendDist,
    // send writes its own Cache-Control (max-age=0) after setHeaders runs,
    // so the per-file headers below only survive with its own switched off.
    cacheControl: false,
    // Everything the build emits into assets/ carries a hash of its contents in
    // its filename - the bundles, and since the models, card art and music are
    // imported rather than named by path, those too. A changed file is a changed
    // name, so a cached copy can never be the wrong one and needs no expiry.
    // index.html keeps the unhashed names of the moment, so it is never cached:
    // it is what tells a browser which hashed files this deployment wants.
    setHeaders(response, filePath) {
      const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
      response.header(
        "Cache-Control",
        hashed ? "public, max-age=31536000, immutable" : "no-cache",
      );
    },
  });
}

seedUsers();

wizardLobbyManager.resetPlayingRooms();

try {
  await server.listen({
    port,
    host,
  });

  console.log(`Wizard backend running at http://${host}:${port}`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}