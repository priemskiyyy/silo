import { expect, test } from "vitest";
import { redis } from "src/redis";
import { createFakeRedis } from "src/redis.fixture";

const KEY = "silo:theme";

test("the factory wraps the client it is given and stores text under the physical key", async () => {
  const fake = createFakeRedis();
  const adapter = redis({ client: fake.client });

  await adapter.set(KEY, { nested: [1, "two", null] });

  expect(adapter.name).toBe("redis");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.client);
  expect(adapter.available()).toBe(true);
  expect(adapter.observe).toBeUndefined();
  expect(fake.store.get(KEY)).toBe('{"nested":[1,"two",null]}');
  adapter.dispose();
});

test("keys lists the whole keyspace by default, and only the match when given one", async () => {
  const fake = createFakeRedis();
  const everything = redis({ client: fake.client });
  const namespaced = redis({ client: fake.client, match: "silo:*" });

  await everything.set("silo:a", 1);
  await everything.set("other:b", 2);

  expect(await everything.keys?.()).toEqual(["silo:a", "other:b"]);
  expect(await namespaced.keys?.()).toEqual(["silo:a"]);
  everything.dispose();
  namespaced.dispose();
});

test("the probe and the text format are the application's when given", async () => {
  const fake = createFakeRedis();
  const adapter = redis({
    client: fake.client,
    available: () => false,
    format: {
      stringify: (value) => `wrapped:${JSON.stringify(value)}`,
      parse: (text) => JSON.parse(text.replace(/^wrapped:/u, "")),
    },
  });

  await adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(fake.store.get(KEY)).toBe('wrapped:"dark"');
  expect(await adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("dispose keeps the data, leaves the client open, and refuses further operations", async () => {
  const fake = createFakeRedis();
  const adapter = redis({ client: fake.client });

  await adapter.set(KEY, "kept");
  adapter.dispose();

  expect(fake.store.get(KEY)).toBe('"kept"');
  expect(await fake.client.get(KEY)).toBe('"kept"');
  expect(() => adapter.get(KEY)).toThrow("disposed redis storage adapter");
});
