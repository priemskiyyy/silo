import { expect, test } from "vitest";
import { cloudflareDurableObjectStorage } from "src/cloudflareDurableObjectStorage";
import { createFakeDurableStorage } from "src/cloudflareDurableObjectStorage.fixture";

const KEY = "silo:users:7:seen";

test("values pass through as structured clones, and absent reads undefined", async () => {
  const fake = createFakeDurableStorage();
  const adapter = cloudflareDurableObjectStorage({ storage: fake.storage });
  const seen = new Date("2026-01-01T00:00:00.000Z");

  await adapter.set(KEY, seen);

  expect(adapter.name).toBe("cloudflare-durable-object-storage");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.storage);
  expect(fake.store.get(KEY)).toEqual(seen);
  expect(await adapter.get(KEY)).toEqual(seen);
  expect(await adapter.get("silo:absent")).toBeUndefined();

  await adapter.set(KEY, null);

  expect(await adapter.get(KEY)).toBeNull();
  adapter.dispose();
});

test("undefined is a removal, and keys lists what the storage holds", async () => {
  const fake = createFakeDurableStorage();
  const adapter = cloudflareDurableObjectStorage({ storage: fake.storage });

  await adapter.set(KEY, 1);
  await adapter.set("silo:theme", "dark");
  await adapter.set(KEY, undefined);

  expect(fake.store.has(KEY)).toBe(false);
  expect(await adapter.keys?.()).toEqual(["silo:theme"]);
  adapter.dispose();
});

test("dispose keeps what the storage holds, and the adapter does not observe", async () => {
  const fake = createFakeDurableStorage();
  const adapter = cloudflareDurableObjectStorage({ storage: fake.storage });

  await adapter.set(KEY, "value");
  adapter.dispose();

  expect(fake.store.size).toBe(1);
  expect(adapter.available()).toBe(true);
  expect("observe" in adapter).toBe(false);
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const fake = createFakeDurableStorage();
  const gated = cloudflareDurableObjectStorage({
    storage: fake.storage,
    available: () => false,
  });

  expect(gated.available()).toBe(false);
  gated.dispose();
});
