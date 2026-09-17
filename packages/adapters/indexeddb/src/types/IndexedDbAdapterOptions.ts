/**
 * Options for `indexedDb()`.
 *
 * @example
 * ```ts
 * const adapter = indexedDb({ name: "acme", store: "silo", sharing: "single-tab" });
 * ```
 */
export type IndexedDbAdapterOptions = {
  /** Database to open, which is also what `native.name` reports. Defaults to `"silo"`. */
  name?: string;
  /** Object store to keep values in, created on first open. Defaults to `"values"`. */
  store?: string;
  /**
   * Version to request. Omitted, the database opens at whatever version it
   * already has, so another library upgrading it cannot lock this adapter out.
   */
  version?: number;
  /**
   * `"cross-tab"`, the default, announces every write to the other tabs on
   * this origin and observes theirs. `"single-tab"` announces nothing, and
   * the adapter exposes no `observe` at all.
   */
  sharing?: "cross-tab" | "single-tab";
  /**
   * Overrides the probe, which otherwise answers whether `indexedDB` exists,
   * so a candidate list can be gated by application state at construction.
   */
  available?: () => boolean;
};
