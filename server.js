// Production entry point for single-process Node hosting (e.g. Hostinger,
// which runs `node server.js`). The backend is compiled to backend/dist by
// the postinstall script, which also builds the frontend into dist/ for the
// backend to serve.
//
// The TypeScript is compiled at build time rather than loaded through tsx,
// because tsx transforms with esbuild's binary and shared hosting refuses to
// execute it (spawn .../@esbuild/linux-x64/bin/esbuild EACCES), which left
// the process crash-looping behind a 503.
//
// No top-level await here: Hostinger's runner loads this file with require(),
// which rejects ES modules that use it.
import { writeFileSync } from "node:fs";

// Shared hosting gives no shell and often no readable stdout, so a crash on
// startup shows only as a 503 from the proxy. Both outcomes are written next
// to this file, where the panel's file manager can reach them: startup.log
// says the server got as far as loading, startup-error.log says why it did
// not. Reading the pair tells you which half of the deployment failed.
const note = (name, text) => {
  try {
    writeFileSync(new URL(name, import.meta.url), `${new Date().toISOString()}\n${text}\n`);
  } catch {
    // Read-only deployment: the console is all there is.
  }
};

note("startup.log", `node ${process.version} on ${process.platform}, loading the backend`);

import("./backend/dist/server.js")
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
