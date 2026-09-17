/** What a bound parameter may be, the intersection of what node:sqlite, better-sqlite3 and bun:sqlite accept. */
export type SqliteValue = string | number | bigint | null | Uint8Array;
