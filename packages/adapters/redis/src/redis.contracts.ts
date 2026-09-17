// Typechecked, never imported: each supported client must fit `RedisClient`
// with no cast, or the structural type has drifted from the clients it names.
import { Redis as UpstashRedis } from "@upstash/redis";
import IoRedis from "ioredis";
import { createClient } from "redis";
import type { RedisClient } from "src/types/RedisClient";

export const ioredis: RedisClient = new IoRedis({ lazyConnect: true });

export const nodeRedis: RedisClient = createClient();

export const upstash: RedisClient = new UpstashRedis({
  url: "https://example.upstash.io",
  token: "token",
  // Without it `get` hands back parsed values and the adapter's own JSON
  // decode would run on an object.
  automaticDeserialization: false,
});
