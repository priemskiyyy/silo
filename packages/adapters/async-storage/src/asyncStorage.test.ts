import { expect, test } from "vitest";
import { asyncStorage } from "src/asyncStorage";
import { createFakeAsyncStorage } from "src/asyncStorage.fixture";

const KEY = "silo:theme";

test("the factory wraps the module it is given", () => {
  const fake = createFakeAsyncStorage();
  const adapter = asyncStorage({ storage: fake.storage });

  expect(adapter.name).toBe("async-storage");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.storage);
  expect(adapter.available()).toBe(true);
  expect(adapter.observe).toBeUndefined();
  adapter.dispose();
});

test("available and format come from the options", async () => {
  const fake = createFakeAsyncStorage();
  const adapter = asyncStorage({
    storage: fake.storage,
    available: () => false,
    format: {
      stringify: (value) => `text:${String(value)}`,
      parse: (text) => text,
    },
  });

  await adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(fake.store.get(KEY)).toBe("text:dark");
  expect(await adapter.get(KEY)).toBe("text:dark");
  adapter.dispose();
});

test("keys copies the module's list, so a caller can mutate it", async () => {
  const fake = createFakeAsyncStorage();
  const adapter = asyncStorage({ storage: fake.storage });

  await adapter.set("silo:a", 1);
  await adapter.set("other:b", 2);
  const keys = await adapter.keys?.();

  expect(keys).toEqual(["silo:a", "other:b"]);
  keys?.push("mutated");
  expect(await adapter.keys?.()).toEqual(["silo:a", "other:b"]);
  adapter.dispose();
});

test("dispose keeps the data and refuses further operations", async () => {
  const fake = createFakeAsyncStorage();
  const adapter = asyncStorage({ storage: fake.storage });

  await adapter.set(KEY, "kept");
  adapter.dispose();

  expect(fake.store.get(KEY)).toBe('"kept"');
  expect(() => adapter.get(KEY)).toThrow(
    "disposed async-storage storage adapter",
  );
});
