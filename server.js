// Production entry point for single-process Node hosting (e.g. Hostinger,
// which runs `node server.js`). The backend is TypeScript, so it is loaded
// through tsx. `npm install` has already built the frontend into dist/ (see
// the postinstall script), which the backend serves.
//
// No top-level await here: Hostinger's runner loads this file with require(),
// which rejects ES modules that use it.
import { writeFileSync } from "node:fs";
import { register } from "tsx/esm/api";

// Shared hosting gives no shell and often no readable stdout, so a crash on
// startup shows only as a 503 from the proxy. Both outcomes are written next
// to this file, where the panel's file manager can reach them: startup.log
// says the server got as far as listening, startup-error.log says why it did
// not. Reading the pair tells you which half of the deployment failed.
const stamp = () => new Date().toISOString();
const note = (name, text) => {
  try {
    writeFileSync(new URL(name, import.meta.url), `${stamp()}\n${text}\n`);
  } catch {
    // Read-only deployment: the console is all there is.
  }
};

note("startup.log", `node ${process.version} on ${process.platform}, loading the backend`);

register();
import("./backend/src/server.ts")
  .then(() => {
    note(
      "startup.log",
      `node ${process.version} on ${process.platform}\n` +
        `PORT=${process.env.PORT ?? "(unset)"} HOST=${process.env.HOST ?? "(unset)"}\n` +
        "backend loaded",
    );
  })
  .catch((error) => {
    note("startup-error.log", String(error?.stack ?? error));
    console.error(error);
    process.exit(1);
  });
