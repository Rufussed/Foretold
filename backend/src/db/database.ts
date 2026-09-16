import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const configuredDatabasePath = process.env.DB_PATH;
const databasePath = configuredDatabasePath
  ? path.resolve(process.cwd(), configuredDatabasePath)
  : path.resolve(currentDirectory, "../../data/wizard.sqlite");

mkdirSync(path.dirname(databasePath), { recursive: true });

// Node's built-in SQLite, so hosting doesn't have to compile a native module
// (better-sqlite3 failed to build on Hostinger's older Linux).
// Rows are typed loosely (unknown) so call sites can cast to their row types,
// as they did with better-sqlite3.
interface Statement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
interface Db {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}
const db = new DatabaseSync(databasePath) as unknown as Db;

const schemaPath = path.resolve(currentDirectory, "schema.sql");
const schema = readFileSync(schemaPath, "utf8");

db.exec(schema);

// schema.sql only creates tables that are missing, so a column added later
// needs an explicit upgrade for databases created before it existed.
const roomPlayerColumns = db
  .prepare("PRAGMA table_info(room_players)")
  .all() as { name: string }[];

if (!roomPlayerColumns.some((column) => column.name === "avatar")) {
  db.exec("ALTER TABLE room_players ADD COLUMN avatar TEXT");
}

// One avatar per room, first claim wins. SQLite treats NULLs as distinct in a
// unique index, so any number of players can be without an avatar. Created
// here rather than in schema.sql so the column above exists first.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS room_players_avatar_unique
  ON room_players(room_id, avatar)
`);

console.log(`SQLite database ready: ${databasePath}`);

// Runs fn inside a transaction, rolling back if it throws.
export function transaction(fn: () => void): void {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export default db;