import type { TextFormat } from "@priemskiyyy/silo";
import type { SecureStoreModule } from "src/types/SecureStoreModule";
import type { SecureStoreOptions } from "src/types/SecureStoreOptions";

/**
 * Options for `secureStore()`.
 *
 * @example
 * ```ts
 * const adapter = secureStore({ store: SecureStore, options: { requireAuthentication: true } });
 * ```
 */
export type SecureStoreAdapterOptions = {
  store: SecureStoreModule;
  options?: SecureStoreOptions;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
