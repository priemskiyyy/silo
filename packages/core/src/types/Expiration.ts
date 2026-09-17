/**
 * Expiry as a lifetime in milliseconds or an absolute Unix timestamp in milliseconds.
 *
 * @example
 * ```ts
 * value<string>({ expires: { in: 60_000 } });
 * value<string>({ expires: { at: Date.UTC(2030, 0, 1) } });
 * ```
 */
export type Expiration =
  { in: number; at?: never } | { at: number; in?: never };
