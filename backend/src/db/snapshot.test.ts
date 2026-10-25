import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { snapshotStamp } from "./snapshot.js";

describe("snapshotStamp", () => {
  it("orders snapshots by date, not by version number", () => {
    const names = [
      "wizard.before-v12.2026-10-25T08-33-18-584.sqlite",
      "wizard.before-v5.2026-10-10T12-52-33-078.sqlite",
      "wizard.before-v9.2026-10-16T09-13-43-754.sqlite",
    ];
    const sorted = [...names].sort((a, b) => snapshotStamp(a).localeCompare(snapshotStamp(b)));
    assert.equal(sorted.at(-1), names[0]);
  });
});
