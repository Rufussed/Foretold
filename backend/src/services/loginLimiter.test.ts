import { describe, expect, it } from "vitest";
import {
  MAX_FAILURES,
  WINDOW_MS,
  clearFailures,
  recordFailure,
  secondsLocked,
} from "./loginLimiter.js";

describe("loginLimiter", () => {
  it("allows tries until the limit, then locks", () => {
    const start = 1_000_000;
    for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailure("Anna", start + i);
    expect(secondsLocked("anna", start + 100)).toBe(0);

    recordFailure("ANNA", start + 200);
    expect(secondsLocked("Anna", start + 300)).toBeGreaterThan(0);
  });

  it("frees the login once the failures age out", () => {
    const start = 5_000_000;
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("bob", start);
    expect(secondsLocked("bob", start + WINDOW_MS - 1)).toBeGreaterThan(0);
    expect(secondsLocked("bob", start + WINDOW_MS)).toBe(0);
  });

  it("is cleared by a right password", () => {
    const start = 9_000_000;
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("cara", start);
    clearFailures("Cara");
    expect(secondsLocked("cara", start + 1)).toBe(0);
  });

  it("keeps each login apart", () => {
    const start = 12_000_000;
    for (let i = 0; i < MAX_FAILURES; i++) recordFailure("dan", start);
    expect(secondsLocked("eve", start + 1)).toBe(0);
  });
});
