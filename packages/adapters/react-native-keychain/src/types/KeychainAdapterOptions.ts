import type { TextFormat } from "@priemskiyyy/silo";
import type { KeychainModule } from "src/types/KeychainModule";
import type { KeychainOptions } from "src/types/KeychainOptions";

/**
 * Options for `keychain()`.
 *
 * @example
 * ```ts
 * const adapter = keychain({ keychain: Keychain, service: { prefix: "acme." }, options: { accessControl: "BiometryAny" } });
 * ```
 */
export type KeychainAdapterOptions = {
  keychain: KeychainModule;
  /** Every entry is one service named `${prefix}${encoded key}`. The prefix defaults to `"silo."`. */
  service?: { prefix?: string };
  options?: KeychainOptions;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
