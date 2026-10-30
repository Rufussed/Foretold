import db from "../db/database.js";

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  email: string;
  created_at: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export class UserService {
  // The display name is the username.
  static createUser(
    username: string,
    passwordHash: string,
    email: string,
  ): User {
    const statement = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `);

    const result = statement.run(
      username,
      passwordHash,
      username,
      email,
    );

    const user = this.getUserById(Number(result.lastInsertRowid));

    if (!user) {
      throw new Error("User was created but could not be retrieved");
    }

    return user;
  }

  // Names are found in any case, so "carlos" signs in as "Carlos". Sign-up
  // keeps names that differ only in case apart; for any made before that,
  // the older account is used.
  static getUserByUsername(username: string): User | null {
    const statement = db.prepare(`
      SELECT
        id,
        username,
        password_hash,
        display_name,
        email,
        created_at
      FROM users
      WHERE LOWER(username) = LOWER(?)
      ORDER BY id
      LIMIT 1
    `);

    const row = statement.get(username) as UserRow | undefined;

    return row ? mapUser(row) : null;
  }

  // Whether a name is taken in any case: "rufus" is taken when "Rufus"
  // exists, so no one can pass for another player by changing capitals.
  static isUsernameTaken(username: string): boolean {
    const row = db
      .prepare(`
        SELECT 1
        FROM users
        WHERE LOWER(username) = LOWER(?)
        LIMIT 1
      `)
      .get(username);

    return row !== undefined;
  }

  // Emails are compared without case, as people type them either way. If two
  // accounts differ only in case, the older one is used.
  static getUserByEmail(email: string): User | null {
    const statement = db.prepare(`
      SELECT
        id,
        username,
        password_hash,
        display_name,
        email,
        created_at
      FROM users
      WHERE LOWER(email) = LOWER(?)
      ORDER BY id
      LIMIT 1
    `);

    const row = statement.get(email) as UserRow | undefined;

    return row ? mapUser(row) : null;
  }

  static getUserById(id: number): User | null {
    const statement = db.prepare(`
      SELECT
        id,
        username,
        password_hash,
        display_name,
        email,
        created_at
      FROM users
      WHERE id = ?
    `);

    const row = statement.get(id) as UserRow | undefined;

    return row ? mapUser(row) : null;
  }

  static searchUsers(query: string, excludedUserId: number): PublicUser[] {
    // % and _ are wildcards in LIKE; escaped, they match only themselves, so
    // a search for "%" cannot list every player.
    const escapedQuery = query
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, (char) => `\\${char}`);
    const normalizedQuery = `%${escapedQuery}%`;

    return db.prepare(`
      SELECT id, username, display_name AS displayName
      FROM users
      WHERE id != ?
        AND (
          LOWER(username) LIKE ? ESCAPE '\\'
          OR LOWER(display_name) LIKE ? ESCAPE '\\'
        )
      ORDER BY display_name COLLATE NOCASE ASC
      LIMIT 20
    `).all(
      excludedUserId,
      normalizedQuery,
      normalizedQuery,
    ) as PublicUser[];
  }
}