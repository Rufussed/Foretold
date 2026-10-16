import { describe, it, expect } from "vitest";
import { containsProfanity } from "./profanityFilter.js";

describe("containsProfanity", () => {
  it("finds listed words in a username, also disguised or German", () => {
    expect(containsProfanity("fuckface")).toBe(true);
    expect(containsProfanity("sh1t_happens")).toBe(true);
    expect(containsProfanity("Scheißkerl")).toBe(true);
  });

  it("lets ordinary names through", () => {
    expect(containsProfanity("Merlin")).toBe(false);
    expect(containsProfanity("Scunthorpe")).toBe(false);
    expect(containsProfanity("grapes_42")).toBe(false);
  });
});
