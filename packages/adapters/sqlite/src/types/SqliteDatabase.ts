import type { SqliteStatement } from "src/types/SqliteStatement";

/**
 * The connection contract shared by node:sqlite, better-sqlite3 and bun:sqlite.
 *
 * @example
 * ```ts
 * import { DatabaseSync } from "node:sqlite";
 *
 * const database: SqliteDatabase = new DatabaseSync("state.db");
 * ```
 */
export type SqliteDatabase = {
  // Method syntax preserves compatibility with the SDK's overloaded methods.
  exec(sql: string): unknown;
  prepare(sql: string): SqliteStatement;
};
