// Confirms accounts' emails by hand, for test accounts whose address nobody
// reads (@wizard.local, @test.local). A real player confirms by the mailed
// link instead.
//
//   npm run verify-user -- Rufus Obi
//
// DB_PATH picks the database, as it does for the server.
import { UserService } from "../services/userService.js";

const names = process.argv.slice(2);

if (names.length === 0) {
  console.log("Name the accounts to confirm: npm run verify-user -- <name> [<name> ...]");
  process.exit(1);
}

let failed = false;

for (const name of names) {
  const user = name.includes("@")
    ? UserService.getUserByEmail(name)
    : UserService.getUserByUsername(name);

  if (!user) {
    console.log(`No account: ${name}`);
    failed = true;
    continue;
  }

  UserService.markEmailVerified(user.id);
  console.log(`Confirmed: ${user.username} <${user.email}>`);
}

process.exit(failed ? 1 : 0);
