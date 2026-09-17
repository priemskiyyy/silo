import type { TextFormat } from "@priemskiyyy/silo";
import type { SqliteDatabase } from "src/types/SqliteDatabase";

/**
 * Options for `sqlite()`.
 *
 * @example
 * ```ts
 * const adapter = sqlite({ database: new DatabaseSync("state.db"), table: "preferences" });
 * ```
 */
export type SqliteAdapterOptions = {
  /** An open connection the application owns, opens and closes. */
  database: SqliteDatabase;
  /** The key-value table, created on first use. Defaults to `"silo"`. Letters, digits and underscores only. */
  table?: string;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
