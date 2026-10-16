import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    // Tests create and delete users and rooms, so they get a database of their
    // own; a test that fails part way would otherwise leave its users in the
    // real one, where they turn up in player search.
    env: {
      DB_PATH: fileURLToPath(new URL("./data/wizard-test.sqlite", import.meta.url)),
    },
  },
});
