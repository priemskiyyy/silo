import { expect, test, vi } from "vitest";
import type { StorageChange } from "@priemskiyyy/silo";
import { createFakeMmkv } from "src/mmkv.fixture";
import { mmkv } from "src/mmkv";

const KEY = "silo:theme";

const observe = (adapter: ReturnType<typeof mmkv>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe the MMKV listener");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("the factory wraps the instance it is given and reads nothing at construction", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });

  expect(adapter.name).toBe("mmkv");
  expect(adapter.mode).toBe("sync");
  expect(adapter.native).toBe(fake.storage);
  expect(adapter.available()).toBe(true);
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("available and format come from the options", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({
    storage: fake.storage,
    available: () => false,
    format: {
      stringify: (value) => `text:${String(value)}`,
      parse: (text) => text,
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(fake.store.get(KEY)).toBe("text:dark");
  expect(adapter.get(KEY)).toBe("text:dark");
  adapter.dispose();
});

test("keys lists the instance's keys exactly as written", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });

  adapter.set("silo:a", 1);
  adapter.set("other:b", 2);

  expect(adapter.keys?.()).toEqual(["silo:a", "other:b"]);
  adapter.dispose();
});

test("a change made through the same instance elsewhere reaches an observer decoded", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });
  const { changes, stop } = observe(adapter);

  fake.storage.set(KEY, JSON.stringify("dark"));
  fake.storage.delete(KEY);

  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: KEY, value: undefined },
  ]);

  stop();
  fake.storage.set(KEY, JSON.stringify("light"));

  expect(changes).toHaveLength(2);
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("a malformed change reports its error without throwing", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });
  const { changes, stop } = observe(adapter);

  expect(() => fake.storage.set(KEY, "not json")).not.toThrow();
  expect(changes).toEqual([
    { key: KEY, error: { cause: expect.any(SyntaxError) } },
  ]);

  stop();
  adapter.dispose();
});

test("dispose silences an observer the consumer never stopped and keeps the data", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });
  const { changes } = observe(adapter);

  adapter.set(KEY, "kept");
  adapter.dispose();
  fake.storage.set("silo:other", JSON.stringify("late"));

  // The echo of the adapter's own write, then nothing after dispose.
  expect(changes).toEqual([{ key: KEY, value: "kept" }]);
  expect(fake.listeners.size).toBe(0);
  expect(fake.store.get(KEY)).toBe('"kept"');
  expect(() => adapter.get(KEY)).toThrow("disposed mmkv storage adapter");
});

test("a failed read in a native notification reports its cause", () => {
  const fake = createFakeMmkv();
  const adapter = mmkv({ storage: fake.storage });
  const { changes } = observe(adapter);
  const failure = new Error("storage unavailable");
  vi.spyOn(fake.storage, "getString").mockImplementation(() => {
    throw failure;
  });
  expect(() => fake.storage.set(KEY, "1")).not.toThrow();
  expect(changes).toEqual([{ key: KEY, error: { cause: failure } }]);
  adapter.dispose();
});
