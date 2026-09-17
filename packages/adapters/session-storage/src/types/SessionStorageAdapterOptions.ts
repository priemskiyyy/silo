import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Options for `sessionStorage()`.
 *
 * @example
 * ```ts
 * const adapter = sessionStorage({ available: () => consent.granted, format: superjson });
 * ```
 */
export type SessionStorageAdapterOptions = {
  /** Overrides the platform availability check. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
