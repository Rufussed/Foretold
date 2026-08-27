import db from "../db/database.js";

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  email: string;
  createdAt: string;
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
  static createUser(
    username: string,
    passwordHash: string,
    displayName: string,
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
      displayName,
      email,
    );

    const user = this.getUserById(Number(result.lastInsertRowid));

    if (!user) {
      throw new Error("User was created but could not be retrieved");
    }

    return user;
  }

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
      WHERE username = ?
    `);

    const row = statement.get(username) as UserRow | undefined;

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
}