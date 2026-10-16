// Removes the users that tests left behind in a database, with everything they
// own: stats, opponents, friend requests and rooms.
//
// Tests sign their users up with @test.local or @example.com addresses, which
// are reserved for testing, so no real player has one. The script only lists
// what it finds; pass --apply to delete it, after a copy of the database is
// saved beside it.
//
//   npx tsx src/db/removeTestUsers.ts            list only
//   npx tsx src/db/removeTestUsers.ts --apply    delete
//
// DB_PATH picks the database, as it does for the server.
import path from "node:path";
import db, { transaction } from "./database.js";

const TEST_EMAIL = `
  (LOWER(email) LIKE '%@test.local' OR LOWER(email) LIKE '%@example.com')
`;

interface TestUser {
  id: number;
  username: string;
  email: string;
}

const apply = process.argv.includes("--apply");

const testUsers = db
  .prepare(`SELECT id, username, email FROM users WHERE ${TEST_EMAIL} ORDER BY id`)
  .all() as TestUser[];
const keptUsers = db
  .prepare(`SELECT id, username, email FROM users WHERE NOT ${TEST_EMAIL} ORDER BY id`)
  .all() as TestUser[];

console.log(`\nTest users (${testUsers.length}):`);
for (const user of testUsers) {
  console.log(`  ${user.id}\t${user.username}\t${user.email}`);
}

console.log(`\nKept (${keptUsers.length}):`);
for (const user of keptUsers) {
  console.log(`  ${user.id}\t${user.username}\t${user.email}`);
}

if (!apply) {
  console.log("\nNothing deleted. Run again with --apply to delete the test users.");
  process.exit(0);
}

if (testUsers.length === 0) {
  console.log("\nNo test users to delete.");
  process.exit(0);
}

const databasePath = path.resolve(
  process.env.DB_PATH ?? path.resolve(import.meta.dirname, "../../data/wizard.sqlite"),
);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
const backupPath = path.join(
  path.dirname(databasePath),
  `${path.basename(databasePath, ".sqlite")}.before-test-cleanup.${stamp}.sqlite`,
);
db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
console.log(`\nBackup saved: ${backupPath}`);

const testUserIds = `SELECT id FROM users WHERE ${TEST_EMAIL}`;
const testRoomIds = `SELECT id FROM rooms WHERE created_by IN (${testUserIds})`;

transaction(() => {
  db.exec(`DELETE FROM games WHERE room_id IN (${testRoomIds})`);
  db.exec(`DELETE FROM room_players WHERE room_id IN (${testRoomIds})`);
  db.exec(`DELETE FROM rooms WHERE id IN (${testRoomIds})`);
  db.exec(`DELETE FROM room_players WHERE user_id IN (${testUserIds})`);
  // Their own history, and their names in real players' opponent lists.
  db.exec(`
    DELETE FROM player_opponents
    WHERE player_id IN (${testUserIds})
      OR (opponent_type = 'user' AND opponent_id IN (${testUserIds}))
  `);
  db.exec(`
    DELETE FROM friend_requests
    WHERE sender_id IN (${testUserIds}) OR receiver_id IN (${testUserIds})
  `);
  db.exec(`DELETE FROM player_stats WHERE user_id IN (${testUserIds})`);
  db.exec(`DELETE FROM users WHERE ${TEST_EMAIL}`);
});

console.log(`Deleted ${testUsers.length} test users.`);
