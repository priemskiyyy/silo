/**
 * Database identity and access to the current connection, reopening it when needed.
 *
 * @example
 * ```ts
 * const database = await silo.native.default.database();
 * database.transaction(["values"], "readonly");
 * ```
 */
export type IndexedDbHandle = {
  /** Database name, exactly as the factory was given it. */
  name: string;
  /** Version the factory requests, or `undefined` when it opens whatever exists. */
  version: number | undefined;
  /** Opens the database if it is closed, and answers with the current connection. */
  database: () => Promise<IDBDatabase>;
};
