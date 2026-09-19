import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pendingMigrations, runMigrations } from "./migrations.js";
import { snapshotDatabase } from "./snapshot.js";

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
// Checked before opening, since opening creates the file: a database that did
// not exist a moment ago has nothing in it worth copying.
const isNewDatabase = !existsSync(databasePath);
const db = new DatabaseSync(databasePath) as unknown as Db;

const schemaPath = path.resolve(currentDirectory, "schema.sql");
const schema = readFileSync(schemaPath, "utf8");

db.exec(schema);

// schema.sql only creates tables that are missing, so it cannot change a table
// that already exists. Every such change lives in migrations.ts, numbered, and
// is applied here once per database - with a copy of the file kept first, in
// case a change goes wrong on data that matters.
const firstPending = pendingMigrations(db)[0];
if (firstPending) {
  if (!isNewDatabase) snapshotDatabase(db, databasePath, firstPending.version);
  runMigrations(db);
}

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