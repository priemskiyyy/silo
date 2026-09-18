import type { SiloSchema } from "src/types/SiloSchema";
import type { StorageAdapter } from "src/types/StorageAdapter";

/**
 * The backends a store runs over, by name, each with the schema of what lives
 * there and an ordered list of candidate adapters, chosen from independently
 * at construction. Keys of `default` are addressed bare; keys of every other
 * storage as `storage.key`, so the same key can live in several storages.
 * A storage may carry its own `namespace`.
 *
 * @example
 * ```ts
 * const storages = {
 *   default: { adapters: [localStorage(), memory()], schema: { theme: value<Theme>({ fallback: "light" }) } },
 *   secure: { adapters: [indexedDb(), memory()], schema: { token: value<string>() } },
 * } satisfies Storages;
 * ```
 */
export type Storages = { default: Storage; [name: string]: Storage };

type Storage = {
  adapters: StorageAdapter[];
  schema: SiloSchema;
  /**
   * Prefix on this storage's physical keys, overriding the store's. `""`
   * drops the prefix, which is what a query string or a cookie jar the
   * application owns wants; the version record stays under the default
   * storage's namespace either way.
   */
  namespace?: string;
  /** Reversible translation between Silo addresses and existing physical keys, including migration metadata. */
  keys?: {
    encode: (key: string) => string;
    decode: (key: string) => string | undefined;
  };
};
