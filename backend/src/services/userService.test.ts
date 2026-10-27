import { afterEach, describe, it, expect } from "vitest";

import db from "../db/database.js";

import { isAdminUsername } from "./adminService.js";
import { UserService } from "./userService.js";

describe("UserService.isUsernameTaken", () => {
  it("counts a name taken in any case", () => {
    const user = UserService.createUser("CaseTaken", "test", "case-taken@example.com");

    try {
      expect(UserService.isUsernameTaken("CaseTaken")).toBe(true);
      expect(UserService.isUsernameTaken("casetaken")).toBe(true);
      expect(UserService.isUsernameTaken("CASETAKEN")).toBe(true);
      expect(UserService.isUsernameTaken("CaseTaken2")).toBe(false);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }
  });
});

describe("UserService.getUserByUsername", () => {
  it("finds the account in any case, keeping its own spelling", () => {
    const user = UserService.createUser("CaseLogin", "test", "case-login@example.com");

    try {
      expect(UserService.getUserByUsername("caselogin")?.id).toBe(user.id);
      expect(UserService.getUserByUsername("CASELOGIN")?.username).toBe("CaseLogin");
      expect(UserService.getUserByUsername("CaseLogin2")).toBeNull();
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    }
  });
});

describe("isAdminUsername", () => {
  const original = process.env.ADMIN_USERNAMES;

  afterEach(() => {
    // Setting undefined would store the string "undefined".
    if (original === undefined) {
      delete process.env.ADMIN_USERNAMES;
    } else {
      process.env.ADMIN_USERNAMES = original;
    }
  });

  it("takes only the names as written, capitals included", () => {
    process.env.ADMIN_USERNAMES = "Rufus, Obi";

    expect(isAdminUsername("Rufus")).toBe(true);
    expect(isAdminUsername("Obi")).toBe(true);
    expect(isAdminUsername("rufus")).toBe(false);
    expect(isAdminUsername("RUFUS")).toBe(false);
    expect(isAdminUsername("Someone")).toBe(false);
  });

  it("makes no one an admin when unset", () => {
    delete process.env.ADMIN_USERNAMES;

    expect(isAdminUsername("Rufus")).toBe(false);
  });
});
