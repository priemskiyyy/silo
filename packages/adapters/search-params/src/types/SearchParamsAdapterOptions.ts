import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Options for `searchParams()`.
 *
 * @example
 * ```ts
 * const adapter = searchParams({ hash: true, sharing: "cross-tab" });
 * ```
 */
export type SearchParamsAdapterOptions = {
  hash?: boolean;
  /**
   * `"cross-tab"` announces every write to the other tabs on this page over
   * a `BroadcastChannel`, and writes theirs into this tab's own URL, so the
   * address bars of every tab on this path converge and a reload in any of
   * them reads what the last one wrote. `"single-tab"`, the default, keeps
   * the URL this tab's own, which is what a URL is by design. Tabs on
   * another path are never reached.
   */
  sharing?: "cross-tab" | "single-tab";
  /**
   * Whether the store's namespace belongs in the parameter names. `hidden`
   * by default, so a link reads `?note=hello`; `visible` keeps the keys
   * apart from other parameters on the same page.
   */
  namespace?: "visible" | "hidden";
  /** Overrides the platform availability check. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
