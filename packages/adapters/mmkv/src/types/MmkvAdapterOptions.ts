import type { TextFormat } from "@priemskiyyy/silo";
import type { MmkvStorage } from "src/types/MmkvStorage";

/**
 * Options for `mmkv()`.
 *
 * @example
 * ```ts
 * const adapter = mmkv({ storage: new MMKV({ id: "app" }), format: superjson });
 * ```
 */
export type MmkvAdapterOptions = {
  storage: MmkvStorage;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
