import type { TextFormat } from "@priemskiyyy/silo";
import type { KvNamespace } from "src/types/KvNamespace";

/**
 * Options for `cloudflareKv()`.
 *
 * @example
 * ```ts
 * const adapter = cloudflareKv({ namespace: env.SETTINGS });
 * ```
 */
export type CloudflareKvAdapterOptions = {
  /** The KV binding the Worker was given. */
  namespace: KvNamespace;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
