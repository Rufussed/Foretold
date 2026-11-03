// Lists every account in a database, guests left out unless asked for: name,
// email, whether the email is confirmed, and when it was made. Nothing is
// changed. Passwords are stored hashed, so they cannot be shown; the seeded
// accounts' are in seedUsers.ts.
//
//   npm run users              signed-up accounts
//   npm run users -- --guests  guests too
//
// DB_PATH picks the database, as it does for the server.
import db from "./database.js";

const withGuests = process.argv.includes("--guests");

const users = db
  .prepare(`
    SELECT id, username, email, email_verified AS verified, is_guest AS guest, created_at AS created
    FROM users
    ${withGuests ? "" : "WHERE is_guest = 0"}
    ORDER BY id
  `)
  .all() as {
  id: number;
  username: string;
  email: string;
  verified: number;
  guest: number;
  created: string;
}[];

console.table(
  users.map((user) => ({
    id: user.id,
    name: user.username,
    email: user.email,
    confirmed: user.verified === 1 ? "yes" : "no",
    ...(withGuests ? { guest: user.guest === 1 ? "yes" : "" } : {}),
    created: user.created,
  })),
);
console.log(`${users.length} accounts`);
