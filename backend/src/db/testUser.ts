// Makes a local test account, confirmed and ready to sign in, at a chosen
// stage of the Roles unlocks (modes/roles/roleLocks.ts). Run again to put an
// existing test account back to a stage. Local only: never for live.
//
//   npm run test-user -- Merlin new       only the first 4 basic roles
//   npm run test-user -- Morgana wood     every basic seal at Wood: the Watcher opens
//   npm run test-user -- Vivien copper    every basic seal at Copper: the Joker too
//   npm run test-user -- Nimue masters    every role open
//
// The password is pass1234 unless a third word gives another. The address is
// <name>@test.local, which nobody reads. DB_PATH picks the database, as it
// does for the server.
import bcrypt from "bcryptjs";
import db from "./database.js";
import { UserService } from "../services/userService.js";
import { playerStatsRepository } from "../game/wizard/services/playerStatsRepository.js";
import { setRolesAllOpen } from "../game/wizard/modes/roles/roleAccess.js";
import { rolesOfKind } from "../game/wizard/modes/roles/roles.js";
import { SEAL_LEVELS } from "../game/wizard/modes/roles/sealLevels.js";

const STAGES = ["new", "wood", "copper", "masters"] as const;
type Stage = (typeof STAGES)[number];

const [name, stageWord = "new", password = "pass1234"] = process.argv.slice(2);
const stage = STAGES.find((entry) => entry === stageWord);

if (process.env.NODE_ENV === "production") {
  console.log("Test accounts are for a local database only.");
  process.exit(1);
}

if (!name || !stage) {
  console.log(`npm run test-user -- <name> [${STAGES.join("|")}] [password]`);
  process.exit(1);
}

function account(username: string): number {
  const existing = UserService.getUserByUsername(username);
  if (existing) return existing.id;
  const user = UserService.createUser(username, bcrypt.hashSync(password!, 10), `${username.toLowerCase()}@test.local`);
  playerStatsRepository.initializeForUser(user.id);
  console.log(`Made ${username} <${user.email}>, password ${password}`);
  return user.id;
}

// Every basic seal at the level's points; nothing else kept.
function sealsAt(userId: number, level: "wood" | "copper" | null): void {
  db.prepare("DELETE FROM role_progress WHERE user_id = ?").run(userId);
  if (!level) return;
  const games = SEAL_LEVELS.find((entry) => entry.id === level)!.at;
  const insert = db.prepare("INSERT INTO role_progress (user_id, role, games, wins) VALUES (?, ?, ?, 0)");
  for (const role of rolesOfKind("basic")) insert.run(userId, role.id, games);
}

const SEALS: Record<Stage, "wood" | "copper" | null> = { new: null, wood: "wood", copper: "copper", masters: null };

const userId = account(name);
UserService.markEmailVerified(userId);
sealsAt(userId, SEALS[stage]);
setRolesAllOpen(userId, stage === "masters");
console.log(`${name}: ${stage}`);
process.exit(0);
