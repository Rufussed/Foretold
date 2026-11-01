import { describe, expect, it } from "vitest";
import db from "../../../../db/database.js";
import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";
import { countPowerUses } from "./powerSeal.js";
import { countsForRoleProgress, devResetRole, getRoleProgress, recordRoleGame, roleGameRecord } from "./roleProgress.js";
import { play, roles } from "./roleTestHelpers.js";

const player = (username: string, extra: Partial<GamePlayer> = {}): GamePlayer => ({
  username,
  avatar: "alchemist" as GamePlayer["avatar"],
  hand: [],
  prediction: null,
  tricksWon: 0,
  score: 0,
  roundScores: [],
  ...extra,
});

const game = (players: GamePlayer[], extra: Partial<WizardGameState> = {}): WizardGameState =>
  ({
    roomId: 1,
    players,
    currentRound: 1,
    totalRounds: 20,
    trumpSuit: null,
    currentTrick: { playedCards: [], winnerUsername: null },
    options: { mode: "roles" },
    ...extra,
  }) as WizardGameState;

const three = (extra: Partial<GamePlayer> = {}) => [player("ana", { role: "thief", ...extra }), player("ben"), player("cy")];

describe("countsForRoleProgress", () => {
  it("counts a full Roles game between humans", () => {
    expect(countsForRoleProgress(game(three()))).toBe(true);
  });

  it("counts half the full length, not less: 10 of 20 rounds for 3 players", () => {
    expect(countsForRoleProgress(game(three(), { totalRounds: 10 }))).toBe(true);
    expect(countsForRoleProgress(game(three(), { totalRounds: 9 }))).toBe(false);
  });

  it("rounds half up: 8 of 15 rounds for 4 players", () => {
    const four = [...three(), player("dee")];
    expect(countsForRoleProgress(game(four, { totalRounds: 8 }))).toBe(true);
    expect(countsForRoleProgress(game(four, { totalRounds: 7 }))).toBe(false);
  });

  it("does not count other modes", () => {
    expect(countsForRoleProgress(game(three(), { options: { mode: "classic" } as NonNullable<WizardGameState["options"]> }))).toBe(false);
  });

  it("does not count a table of Apprentice NPCs alone, but does a mix", () => {
    const bo = player("Bo NPC", { botPersonality: "apprentice" });
    const apprentices = [player("ana", { role: "thief" }), bo, player("Cy NPC")];
    expect(countsForRoleProgress(game(apprentices))).toBe(false);
    bo.botPersonality = "adept";
    expect(countsForRoleProgress(game(apprentices))).toBe(true);
  });
});

describe("roleGameRecord", () => {
  it("adds up the player's own role's points only, and their power uses", () => {
    const ana = player("ana", {
      role: "thief",
      powerUses: 3,
      roundScores: [
        { prediction: 1, tricksWon: 1, score: 30, roleBonuses: { thief: 10, farmer: -5 } },
        { prediction: 0, tricksWon: 0, score: 20, roleBonuses: { thief: 20 } },
        { prediction: 0, tricksWon: 1, score: -10 },
      ],
    });
    expect(roleGameRecord(ana, true)).toEqual({ role: "thief", won: true, powerUses: 3, rolePoints: 30 });
  });

  it("has nothing for a player without a role", () => {
    expect(roleGameRecord(player("ben"), false)).toBeNull();
  });
});

describe("countPowerUses", () => {
  it("counts a Thief's 1 played in the lead suit", () => {
    const ana = player("ana", { role: "thief" });
    const players = [ana, player("ben"), player("cy")];
    const state = game(players, {
      currentTrick: { playedCards: [play("ben", 8), play("ana", 1)], winnerUsername: null },
    });
    countPowerUses(state, "ben", roles({ ana: "thief" }));
    expect(ana.powerUses).toBe(1);
  });

  it("does not count a Thief's 1 off the lead suit, not a trump", () => {
    const ana = player("ana", { role: "thief" });
    const players = [ana, player("ben"), player("cy")];
    const state = game(players, {
      currentTrick: { playedCards: [play("ben", 8), play("ana", 1, "Blue")], winnerUsername: null },
    });
    countPowerUses(state, "ben", roles({ ana: "thief" }));
    expect(ana.powerUses).toBeUndefined();
  });
});

describe("recordRoleGame", () => {
  it("makes the row on the first game and adds to it after", () => {
    const user = db
      .prepare("INSERT INTO users (username, password_hash, display_name, email) VALUES (?, ?, ?, ?)")
      .run("role-progress-test", "test", "Role Progress Test", "role-progress-test@example.com");
    const userId = Number(user.lastInsertRowid);

    try {
      recordRoleGame(userId, { role: "thief", won: true, powerUses: 2, rolePoints: 20 });
      recordRoleGame(userId, { role: "thief", won: false, powerUses: 1, rolePoints: -5 });
      recordRoleGame(userId, { role: "fisher", won: false, powerUses: 0, rolePoints: 0 });

      const rows = db
        .prepare("SELECT role, games, wins, power_uses AS powerUses, role_points AS rolePoints FROM role_progress WHERE user_id = ? ORDER BY role")
        .all(userId);
      expect(rows).toEqual([
        { role: "fisher", games: 1, wins: 0, powerUses: 0, rolePoints: 0 },
        { role: "thief", games: 2, wins: 1, powerUses: 3, rolePoints: 15 },
      ]);

      // What the Profile gets: games and wins by role.
      expect(getRoleProgress(userId).sort((a, b) => a.role.localeCompare(b.role))).toEqual([
        { role: "fisher", games: 1, wins: 0 },
        { role: "thief", games: 2, wins: 1 },
      ]);

      devResetRole(userId, "thief");
      expect(getRoleProgress(userId)).toEqual([{ role: "fisher", games: 1, wins: 0 }]);
    } finally {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }

    // Deleting the player deleted their rows.
    expect(db.prepare("SELECT COUNT(*) AS count FROM role_progress WHERE user_id = ?").get(userId)).toEqual({ count: 0 });
  });
});
