// Structural changes to an existing database, numbered and applied once each.
//
// schema.sql creates whatever table is missing, which is all a brand-new file
// needs, but it cannot change a table that already exists: CREATE TABLE IF NOT
// EXISTS skips it whole, new column and all. So every change to the shape of a
// live table belongs here instead.
//
// SQLite stores a number per database file (PRAGMA user_version, 0 on a new
// one) and this list picks up from there, so each entry runs exactly once, in
// order, on every database however old. To change the shape of a table: append
// an entry, never edit or reorder the ones above it - a database that has
// already passed a version will not look at it again.
//
// An entry must also be safe on a database that happens to be in the shape it
// wants already, because the first entries below describe changes that were
// once applied by hand, before this list existed.

interface Statement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}
export interface MigratableDb {
  exec(sql: string): void;
  prepare(sql: string): Statement;
}

interface Migration {
  version: number;
  description: string;
  up(db: MigratableDb): void;
}

const hasColumn = (db: MigratableDb, table: string, column: string): boolean =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
    (info) => info.name === column,
  );

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "room_players.avatar, one avatar per room",
    up(db) {
      // Databases from before this list already have the column, added by hand
      // in database.ts; only older ones need it.
      if (!hasColumn(db, "room_players", "avatar")) {
        db.exec("ALTER TABLE room_players ADD COLUMN avatar TEXT");
      }
      // First claim wins. SQLite treats NULLs as distinct in a unique index, so
      // any number of players in a room can be without an avatar.
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS room_players_avatar_unique
        ON room_players(room_id, avatar)
      `);
    },
  },
];

const currentVersion = (db: MigratableDb): number =>
  Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);

export const latestVersion = (): number =>
  MIGRATIONS.reduce((highest, migration) => Math.max(highest, migration.version), 0);

// Everything newer than the file's own version, oldest first.
export const pendingMigrations = (db: MigratableDb): Migration[] =>
  MIGRATIONS.filter((migration) => migration.version > currentVersion(db)).sort(
    (a, b) => a.version - b.version,
  );

export function runMigrations(db: MigratableDb): void {
  for (const migration of pendingMigrations(db)) {
    // One transaction each, so a change that fails part way leaves the database
    // on its previous version rather than half migrated. user_version is set
    // inside it, so the record cannot disagree with what was applied.
    db.exec("BEGIN");
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} (${migration.description}) failed: ${String(error)}`,
      );
    }
    console.log(`Migrated database to version ${migration.version}: ${migration.description}`);
  }
}
