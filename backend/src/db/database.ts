import "dotenv/config";
import Database from "better-sqlite3";
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

const db = new Database(databasePath);

const schemaPath = path.resolve(currentDirectory, "schema.sql");
const schema = readFileSync(schemaPath, "utf8");

db.exec(schema);

console.log(`SQLite database ready: ${databasePath}`);

export default db;