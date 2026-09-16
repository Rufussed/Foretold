// Production entry point for single-process Node hosting (e.g. Hostinger,
// which runs `node server.js`). The backend is TypeScript, so it is loaded
// through tsx. `npm install` has already built the frontend into dist/ (see
// the postinstall script), which the backend serves.
//
// No top-level await here: Hostinger's runner loads this file with require(),
// which rejects ES modules that use it.
import { register } from "tsx/esm/api";

register();
import("./backend/src/server.ts").catch((error) => {
  console.error(error);
  process.exit(1);
});
