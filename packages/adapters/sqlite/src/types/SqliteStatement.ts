import type { SqliteValue } from "src/types/SqliteValue";

/**
 * A prepared statement, as node:sqlite, better-sqlite3 and bun:sqlite all
 * shape it: the three answer `get` with one row or `undefined`, `all` with
 * every row, and `run` with what the driver counts.
 */
export type SqliteStatement = {
  // Method parameters must remain bivariant to accept the SDK's overloaded methods.
  get(...params: SqliteValue[]): unknown;
  run(...params: SqliteValue[]): unknown;
  all(...params: SqliteValue[]): unknown[];
};
