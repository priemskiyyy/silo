import type { TextFormat } from "@priemskiyyy/silo";
import type { RedisClient } from "src/types/RedisClient";

/**
 * Options for `redis()`.
 *
 * @example
 * ```ts
 * const adapter = redis({ client, match: "silo:*" });
 * ```
 */
export type RedisAdapterOptions = {
  client: RedisClient;
  /** The pattern `keys()` lists. Defaults to `"*"`, the whole keyspace. */
  match?: string;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
