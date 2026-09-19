import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import type { MigratableDb } from "./migrations.js";

// A copy of the database file, taken before a structural change is applied, so
// a migration that goes wrong on live data can be undone by putting the copy
// back. VACUUM INTO writes a consistent copy in one statement, without stopping
// the server or locking anyone out.
//
// Only taken when a migration is actually pending: a restart that changes
// nothing does not need a copy, and copying on every start would fill the disk
// with identical files.

const KEEP = 5;

// wizard.sqlite -> wizard.before-v2.2026-09-19T12-30-00.sqlite, beside it.
const snapshotPath = (databasePath: string, version: number): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  const name = path.basename(databasePath, path.extname(databasePath));
  return path.join(path.dirname(databasePath), `${name}.before-v${version}.${stamp}.sqlite`);
};

export function snapshotDatabase(
  db: MigratableDb,
  databasePath: string,
  version: number,
): string | null {
  const target = snapshotPath(databasePath, version);
  try {
    // The path goes into the SQL, so any quote in it has to be doubled.
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`Database snapshot before migrating: ${target}`);
    pruneSnapshots(databasePath);
    return target;
  } catch (error) {
    // A read-only or full disk must not stop the server from starting: say so
    // and carry on, since the alternative is no server at all.
    console.error(`Could not snapshot the database: ${String(error)}`);
    return null;
  }
}

// Keeps the newest few; the names sort by date, so the oldest are at the front.
function pruneSnapshots(databasePath: string): void {
  const directory = path.dirname(databasePath);
  const prefix = `${path.basename(databasePath, path.extname(databasePath))}.before-v`;
  try {
    const snapshots = readdirSync(directory)
      .filter((name) => name.startsWith(prefix) && name.endsWith(".sqlite"))
      .sort();
    for (const name of snapshots.slice(0, Math.max(snapshots.length - KEEP, 0))) {
      unlinkSync(path.join(directory, name));
    }
  } catch {
    // Housekeeping only: an unreadable directory is not worth failing over.
  }
}
