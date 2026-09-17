import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Options for `http()`.
 *
 * @example
 * ```ts
 * const adapter = http({
 *   url: "https://api.example.com/kv",
 *   headers: () => ({ authorization: `Bearer ${session.token}` }),
 * });
 * ```
 */
export type HttpAdapterOptions = {
  /** Base URL of the key-value resource. A trailing slash is tolerated. */
  url: string;
  /** Headers for every request, or a function that answers them per request, awaited, so a token can be read fresh each time. */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** The fetch to use. Omitted, `globalThis.fetch` is read at call time, so a polyfill installed later is honoured. */
  fetch?: typeof fetch;
  /** `false` drops `keys` from the adapter, for a server that has no key list. Defaults to `true`. */
  keys?: boolean;
  /** Overrides the platform availability check. */
  available?: () => boolean;
  /** Replaces JSON for the request and response bodies, such as `superjson` or `devalue`; the server must speak the same format. Changing it over existing data is a migration. */
  format?: TextFormat;
};
