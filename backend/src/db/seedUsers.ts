import bcrypt from "bcryptjs";
import { UserService } from "../services/userService.js";

// The accounts to play with on a fresh database: without them the first thing
// anyone meets is the registration form, and a new deployment (or a wiped
// wizard.sqlite) needs two players before a game can be dealt at all.
//
// These passwords are in the repository, so the accounts are only as private
// as the source. Set SEED_USERS=off to leave a database alone - do that for
// any deployment reachable from outside.
const SEEDS = [
  { username: "Rufus", lastName: "Rufus", email: "rufus@wizard.local", password: "pass1234" },
  { username: "Obi", lastName: "Obi", email: "obi@wizard.local", password: "pass1234" },
] as const;

export function seedUsers(): void {
  if (process.env.SEED_USERS === "off") return;

  for (const seed of SEEDS) {
    // Only ever creates what is missing: an existing account keeps its
    // password, so a seeded user who changes theirs is not reset on restart.
    if (UserService.getUserByUsername(seed.username)) continue;

    // The same cost the registration route uses, so these hashes are
    // indistinguishable from a real sign-up's.
    UserService.createUser(
      seed.username,
      bcrypt.hashSync(seed.password, 10),
      seed.email,
      seed.lastName,
      "2000-01-01",
    );
    console.log(`Seeded user: ${seed.username}`);
  }
}
