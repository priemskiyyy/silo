import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Options for `cookie()`.
 *
 * @example
 * ```ts
 * const adapter = cookie({ maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
 * ```
 */
export type CookieAdapterOptions = {
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  /** Lifetime in seconds. Omitted, the cookie is a session cookie. */
  maxAge?: number;
  /**
   * Whether the store's namespace belongs in the cookie names. `visible` by
   * default, because a cookie jar is shared by everything on the site;
   * `hidden` for an application that owns its jar.
   */
  namespace?: "visible" | "hidden";
  /** Overrides the platform availability check. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
