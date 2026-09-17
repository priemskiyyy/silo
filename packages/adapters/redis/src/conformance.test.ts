import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { redis } from "src/redis";
import { createFakeRedis } from "src/redis.fixture";

testStorageAdapter({
  name: "redis",
  createAdapter: () => redis({ client: createFakeRedis().client }),
});
