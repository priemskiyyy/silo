import { expect, test, vi } from "vitest";
import { cloudflareKv } from "src/cloudflareKv";
import { createFakeKvNamespace } from "src/cloudflareKv.fixture";

const KEY = "silo:users:7:theme";

test("values are read in text mode, so a stored null stays distinct from an absent key", async () => {
  const fake = createFakeKvNamespace();
  const get = vi.spyOn(fake.namespace, "get");
  const adapter = cloudflareKv({ namespace: fake.namespace });

  await adapter.set(KEY, null);

  expect(adapter.name).toBe("cloudflare-kv");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.namespace);
  expect(fake.store.get(KEY)).toBe("null");
  expect(await adapter.get(KEY)).toBeNull();
  expect(get).toHaveBeenCalledWith(KEY, "text");
  expect(await adapter.get("silo:absent")).toBeUndefined();
  adapter.dispose();
});

test("keys walks every page of the list until the namespace says it is complete", async () => {
  const fake = createFakeKvNamespace();
  const adapter = cloudflareKv({ namespace: fake.namespace });
  const written = ["silo:a", "silo:b", "silo:c", "silo:d", "silo:e"];

  for (const key of written) {
    await adapter.set(key, key);
  }

  expect(await adapter.keys?.()).toEqual(written);
  expect(fake.lists).toEqual([{}, { cursor: "2" }, { cursor: "4" }]);
  adapter.dispose();
});

test("the probe and the text format are the application's when given", async () => {
  const fake = createFakeKvNamespace();
  const adapter = cloudflareKv({
    namespace: fake.namespace,
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

test("dispose keeps what the namespace holds, and the adapter does not observe", async () => {
  const fake = createFakeKvNamespace();
  const adapter = cloudflareKv({ namespace: fake.namespace });

  await adapter.set(KEY, "dark");
  adapter.dispose();

  expect(fake.store.size).toBe(1);
  expect(adapter.available()).toBe(true);
  expect("observe" in adapter).toBe(false);
});
