/**
 * The Redis methods shared by ioredis, node-redis and Upstash.
 *
 * @example
 * ```ts
 * import Redis from "ioredis";
 *
 * const client: RedisClient = new Redis(process.env.REDIS_URL);
 * ```
 */
export type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
};
