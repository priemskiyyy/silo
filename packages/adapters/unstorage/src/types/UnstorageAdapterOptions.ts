import type { UnstorageInstance } from "src/types/UnstorageInstance";

/**
 * Options for `unstorage()`.
 *
 * @example
 * ```ts
 * const adapter = unstorage({ storage: createStorage({ driver: redisDriver({ base: "acme" }) }) });
 * ```
 */
export type UnstorageAdapterOptions = {
  /** The unstorage instance to persist through, with its driver already mounted. */
  storage: UnstorageInstance;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
};
