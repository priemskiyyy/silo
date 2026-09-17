import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { RedisAdapterOptions } from "src/types/RedisAdapterOptions";

/**
 * Stores JSON text through a connected ioredis, node-redis or Upstash client.
 *
 * @example
 * ```ts
 * const adapter = redis({ client, match: "silo:*" });
 * ```
 */
export const redis = ({
  client,
  match = "*",
  available = () => true,
  format,
}: RedisAdapterOptions) =>
  createTextStorageAdapter({
    mode: "async",
    name: "redis",
    native: client,
    format,
    read: (key) => client.get(key),
    write: async (key, text) => {
      await client.set(key, text);
    },
    remove: async (key) => {
      await client.del(key);
    },
    // KEYS scans the whole keyspace; match filters only the returned keys.
    keys: () => client.keys(match),
    available,
    dispose: () => {},
  });
