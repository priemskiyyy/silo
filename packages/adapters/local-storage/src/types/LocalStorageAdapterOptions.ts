import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Options for `localStorage()`.
 *
 * @example
 * ```ts
 * const adapter = localStorage({ available: () => consent.granted, format: superjson });
 * ```
 */
export type LocalStorageAdapterOptions = {
  /** Overrides the platform availability check. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
