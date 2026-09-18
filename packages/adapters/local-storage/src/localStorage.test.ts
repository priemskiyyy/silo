import { beforeEach, expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "src/localStorage";
import type { StorageChange } from "@priemskiyyy/silo";

const KEY = "silo:theme";

beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

const storageEvent = (init: StorageEventInit) =>
  globalThis.dispatchEvent(new StorageEvent("storage", init));

const observe = (adapter: ReturnType<typeof localStorage>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe the storage event");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("the factory reads the platform on first use and never again", () => {
  const platform = vi.spyOn(globalThis, "localStorage", "get");
  const adapter = localStorage();

  expect(
    platform,
    "resolving the platform in the factory call is what breaks a server render",
  ).not.toHaveBeenCalled();
  expect(adapter.name).toBe("local-storage");
  expect(adapter.mode).toBe("sync");

  adapter.get(KEY);
  adapter.get(KEY);

  expect(platform).toHaveBeenCalledOnce();
  expect(adapter.native).toBe(globalThis.localStorage);
  adapter.dispose();
});

test("a value lands in the area as its JSON text and reads back decoded", () => {
  const adapter = localStorage();
  const value = { nested: [1, "two", null] };

  adapter.set(KEY, value);

  expect(globalThis.localStorage.getItem(KEY)).toBe(JSON.stringify(value));
  expect(adapter.get(KEY)).toEqual(value);
  adapter.dispose();
});

test("available and format are the application's when given", () => {
  const adapter = localStorage({
    available: () => false,
    format: {
      stringify: (stored: unknown) => `!${JSON.stringify(stored)}`,
      parse: (text: string) => JSON.parse(text.slice(1)),
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(globalThis.localStorage.getItem(KEY)).toBe('!"dark"');
  expect(adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("a refused write propagates to the caller", () => {
  const adapter = localStorage();
  const quota = new DOMException("quota", "QuotaExceededError");

  // jsdom hands out a Proxy per storage area, so the prototype is where a
  // refusal can be planted.
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw quota;
  });

  expect(
    () => adapter.set(KEY, "value"),
    "the core turns a refused write into an error status and cannot see one that was swallowed",
  ).toThrow(quota);
  adapter.dispose();
});

test("an observer reports a write from another tab", () => {
  const adapter = localStorage();
  const { changes, stop } = observe(adapter);

  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.localStorage,
  });

  expect(changes).toEqual([{ key: KEY, value: "dark" }]);

  stop();
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("light"),
    storageArea: globalThis.localStorage,
  });

  expect(changes).toHaveLength(1);
  adapter.dispose();
});

test("an observer ignores the other web storage", () => {
  const adapter = localStorage();
  const { changes } = observe(adapter);
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.sessionStorage,
  });

  expect(
    changes,
    "both storages fire on the same window, so only the storage area tells them apart",
  ).toEqual([]);
  adapter.dispose();
});

test("an observer reports a clear as { key: null }", () => {
  const adapter = localStorage();
  const { changes } = observe(adapter);
  storageEvent({ key: null, storageArea: globalThis.localStorage });

  expect(changes).toEqual([{ key: null }]);
  adapter.dispose();
});

test("an observer falls silent after dispose", () => {
  const adapter = localStorage();
  const { changes } = observe(adapter);
  adapter.dispose();
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.localStorage,
  });

  expect(changes).toEqual([]);
});

test("blocked site data reads as an absent platform", () => {
  vi.spyOn(globalThis, "localStorage", "get").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });

  const adapter = localStorage();

  expect(adapter.native).toBeNull();
  expect(adapter.get(KEY)).toBeUndefined();
  expect(() => adapter.set(KEY, "value")).toThrow(/no localStorage/);
  expect(() => adapter.remove(KEY)).toThrow(/no localStorage/);
  expect(() => observe(adapter).stop()).not.toThrow();
  adapter.dispose();
});

test("a silo persists through this adapter and rehydrates from it", () => {
  const Schema = { theme: value<string>({ fallback: "light" }) };
  const silo = new Silo({
    storages: { default: { adapters: [localStorage()], schema: Schema } },
  });

  silo.value("theme").set("dark");

  expect(
    globalThis.localStorage.getItem(KEY),
    "the core composes the physical key and the adapter must store it untouched",
  ).toBe('"dark"');

  const reloaded = new Silo({
    storages: { default: { adapters: [localStorage()], schema: Schema } },
  });

  expect(
    reloaded.value("theme").get(),
    "a sync adapter hydrates inside value(), so the first read already sees the stored value",
  ).toBe("dark");
  silo.dispose();
  reloaded.dispose();
});

test("a silo rereads a value another tab wrote", () => {
  const silo = new Silo({
    storages: {
      default: {
        adapters: [localStorage()],
        schema: { theme: value<string>({ fallback: "light" }) },
      },
    },
  });
  const theme = silo.value("theme");

  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.localStorage,
  });

  expect(theme.get()).toBe("dark");
  silo.dispose();
});

test("dispose unregisters browser listeners and repeated stops do nothing", () => {
  const added = vi.spyOn(globalThis, "addEventListener");
  const removed = vi.spyOn(globalThis, "removeEventListener");
  const adapter = localStorage();
  const first = observe(adapter);
  const second = observe(adapter);
  const handlers = added.mock.calls.flatMap(([event, handler]) => {
    if (event !== "storage") {
      return [];
    }

    return [handler];
  });

  first.stop();
  adapter.dispose();
  expect(removed.mock.calls).toHaveLength(2);
  first.stop();
  second.stop();

  expect(handlers).toHaveLength(2);
  expect(removed.mock.calls).toEqual(
    handlers.map((handler) => ["storage", handler]),
  );
});
