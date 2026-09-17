import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { SqliteAdapterOptions } from "src/types/SqliteAdapterOptions";
import type { SqliteStatement } from "src/types/SqliteStatement";

// The table name is interpolated into SQL and must be validated.
const TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Statements = {
  select: SqliteStatement;
  upsert: SqliteStatement;
  remove: SqliteStatement;
  list: SqliteStatement;
};

const cell = (row: unknown): unknown => {
  if (typeof row !== "object" || row === null) {
    return undefined;
  }

  return Object.values(row).at(0);
};

/**
 * Stores JSON text in a SQLite table, created lazily. The application owns the connection.
 *
 * @example
 * ```ts
 * const adapter = sqlite({ database: new DatabaseSync("state.db") });
 * ```
 */
export const sqlite = ({
  database,
  table = "silo",
  available = () => true,
  format,
}: SqliteAdapterOptions) => {
  if (!TABLE_NAME.test(table)) {
    throw new Error(
      `The sqlite adapter cannot use the table "${table}": a table name is letters, digits and underscores, and starts with a letter or an underscore.`,
    );
  }

  let prepared: Statements | null = null;

  const statements = () => {
    if (prepared !== null) {
      return prepared;
    }

    database.exec(
      `CREATE TABLE IF NOT EXISTS "${table}" (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    prepared = {
      select: database.prepare(`SELECT value FROM "${table}" WHERE key = ?`),
      upsert: database.prepare(
        `INSERT INTO "${table}" (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ),
      remove: database.prepare(`DELETE FROM "${table}" WHERE key = ?`),
      list: database.prepare(`SELECT key FROM "${table}"`),
    };

    return prepared;
  };

  return createTextStorageAdapter({
    mode: "sync",
    name: "sqlite",
    native: database,
    format,
    read: (key) => {
      const row = statements().select.get(key);

      if (row === undefined) {
        return undefined;
      }

      const text = cell(row);

      if (typeof text !== "string") {
        throw new Error(
          `The sqlite adapter found something that is not text under "${key}" in "${table}".`,
        );
      }

      return text;
    },
    write: (key, text) => {
      statements().upsert.run(key, text);
    },
    remove: (key) => {
      statements().remove.run(key);
    },
    keys: () =>
      statements()
        .list.all()
        .flatMap((row) => {
          const key = cell(row);

          return typeof key === "string" ? [key] : [];
        }),
    available,
    dispose: () => {},
  });
};
