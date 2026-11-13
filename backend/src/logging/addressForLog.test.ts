import { describe, expect, it } from "vitest";
import { addressForLog } from "./addressForLog.js";

describe("addressForLog", () => {
  it("hides the socket's token", () => {
    expect(addressForLog("/wizard/games/12/socket?token=abc.def.ghi")).toBe(
      "/wizard/games/12/socket?token=[hidden]",
    );
  });

  it("keeps the other parts of the address", () => {
    expect(addressForLog("/x?a=1&token=secret&b=2")).toBe("/x?a=1&token=[hidden]&b=2");
  });

  it("leaves addresses without a token alone", () => {
    expect(addressForLog("/users/me")).toBe("/users/me");
  });
});
