import { describe, expect, it } from "vitest";
import { errorCode, withErrorCode } from "./errorCodes.js";

describe("error codes", () => {
  it("finds the code for a known message", () => {
    expect(errorCode("Room is full")).toEqual({ code: "roomFull" });
    expect(errorCode("It is not this player's turn")).toEqual({ code: "notYourTurn" });
  });

  it("passes on the number in a message with one", () => {
    expect(errorCode("Please wait 30 seconds between posts")).toEqual({
      code: "postCooldown",
      values: { seconds: "30" },
    });
  });

  it("has no code for a message it does not know", () => {
    expect(errorCode("Admins only")).toBeNull();
  });

  it("adds the code beside the English message", () => {
    expect(withErrorCode({ error: "Room is full" })).toEqual({
      error: "Room is full",
      code: "roomFull",
    });
  });

  it("leaves other bodies alone", () => {
    const body = { status: "ok" };
    expect(withErrorCode(body)).toBe(body);
    expect(withErrorCode({ error: "Admins only" })).toEqual({ error: "Admins only" });
    expect(withErrorCode("text")).toBe("text");
  });
});
