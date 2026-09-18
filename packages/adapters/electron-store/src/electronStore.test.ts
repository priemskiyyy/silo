import { Silo, value } from "@priemskiyyy/silo";
import type { StorageChange } from "@priemskiyyy/silo";
import { expect, test, vi } from "vitest";
import { electronStore } from "src/electronStore";
import { createFakeStore } from "src/electronStore.fixture";
import { encodeKey } from "src/encodeKey";

const KEY = "silo:users:v1.2:theme";

test("every key reaches the store percent encoded, dots included, and lists decoded", () => {
  const fake = createFakeStore();
  const set = vi.spyOn(fake.store, "set");
  const adapter = electronStore({ store: fake.store });

  adapter.set(KEY, "dark");

  expect(set).toHaveBeenCalledWith("silo%3Ausers%3Av1%2E2%3Atheme", "dark");
  expect([...fake.values.keys()][0]).not.toContain(".");
  expect(adapter.keys?.()).toEqual([KEY]);
  expect(encodeKey("a b/c?d=1&e")).toBe("a%20b%2Fc%3Fd%3D1%26e");
  adapter.dispose();
});

test("a key another writer stored under a plain name is listed as it is", () => {
  const fake = createFakeStore();
  const adapter = electronStore({ store: fake.store });

  fake.store.set("100%", "theirs");

  expect(adapter.keys?.()).toEqual(["100%"]);
  adapter.dispose();
});

test("values pass through, undefined removes, and null stays distinct from absent", () => {
  const fake = createFakeStore();
  const adapter = electronStore({ store: fake.store });

  adapter.set(KEY, { nested: [1, null] });

  expect(fake.values.get(encodeKey(KEY))).toEqual({ nested: [1, null] });

  adapter.set(KEY, null);

  expect(adapter.get(KEY)).toBeNull();

  adapter.set(KEY, undefined);

  expect(adapter.get(KEY)).toBeUndefined();
  expect(fake.values.has(encodeKey(KEY))).toBe(false);
  adapter.dispose();
});

test("an observer reports each changed key once, decoded, with undefined for a removal", () => {
  const fake = createFakeStore();
  const adapter = electronStore({ store: fake.store });
  const changes: StorageChange[] = [];
  const stop = adapter.observe?.((change) => changes.push(change));

  fake.store.set(encodeKey(KEY), "dark");
  // The same JSON again is not a change, however fresh the object.
  fake.store.set(encodeKey(KEY), "dark");
  fake.store.set("other", 1);
  fake.store.delete(encodeKey(KEY));

  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: "other", value: 1 },
    { key: KEY, value: undefined },
  ]);

  stop?.();
  fake.store.set(encodeKey(KEY), "light");

  expect(changes).toHaveLength(3);
  adapter.dispose();
});

test("dispose releases an observer nobody stopped, and keeps the data", () => {
  const fake = createFakeStore();
  const adapter = electronStore({ store: fake.store });
  const changes: StorageChange[] = [];

  adapter.observe?.((change) => changes.push(change));
  adapter.set(KEY, "dark");
  adapter.dispose();
  fake.store.set(encodeKey(KEY), "light");

  // The adapter's own write echoed once; nothing after dispose.
  expect(changes).toEqual([{ key: KEY, value: "dark" }]);
  expect(fake.listeners.size).toBe(0);
  expect(fake.values.get(encodeKey(KEY))).toBe("light");
});

test("a silo persists through this adapter and rereads a write from another process", () => {
  const fake = createFakeStore();
  const Schema = { theme: value<"light" | "dark">({ fallback: "light" }) };
  const silo = new Silo({
    storages: {
      default: {
        adapters: [electronStore({ store: fake.store })],
        schema: Schema,
      },
    },
  });
  const theme = silo.value("theme");

  theme.set("dark");

  expect(fake.values.get("silo%3Atheme")).toBe("dark");

  fake.store.set("silo%3Atheme", "light");

  expect(theme.get()).toBe("light");
  silo.dispose();
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const fake = createFakeStore();
  const gated = electronStore({ store: fake.store, available: () => false });

  expect(gated.available()).toBe(false);
  gated.dispose();
});
