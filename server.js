// Production entry point for single-process Node hosting (e.g. Hostinger,
// which runs `node server.js`). The backend is TypeScript, so it is loaded
// through tsx. `npm install` has already built the frontend into dist/ (see
// the postinstall script), which the backend serves.
import { register } from "tsx/esm/api";

register();
await import("./backend/src/server.ts");
