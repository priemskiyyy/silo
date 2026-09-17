import type { TextFormat } from "@priemskiyyy/silo";
import type { AsyncStorageInstance } from "src/types/AsyncStorageInstance";

/**
 * Options for `asyncStorage()`.
 *
 * @example
 * ```ts
 * const adapter = asyncStorage({ storage: AsyncStorage, format: superjson });
 * ```
 */
export type AsyncStorageAdapterOptions = {
  storage: AsyncStorageInstance;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
