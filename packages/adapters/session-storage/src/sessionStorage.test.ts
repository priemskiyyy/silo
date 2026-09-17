import { beforeEach, expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { sessionStorage } from "src/sessionStorage";
import type { StorageChange } from "@priemskiyyy/silo";

const KEY = "silo:theme";

beforeEach(() => {
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();
});

const storageEvent = (init: StorageEventInit) =>
  globalThis.dispatchEvent(new StorageEvent("storage", init));

const observe = (adapter: ReturnType<typeof sessionStorage>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe the storage event");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("the factory reads the platform on first use and never again", () => {
  const platform = vi.spyOn(globalThis, "sessionStorage", "get");
  const adapter = sessionStorage();

  expect(
    platform,
    "resolving the platform in the factory call is what breaks a server render",
  ).not.toHaveBeenCalled();
  expect(adapter.name).toBe("session-storage");
  expect(adapter.mode).toBe("sync");

  adapter.get(KEY);
  adapter.get(KEY);

  expect(platform).toHaveBeenCalledOnce();
  expect(adapter.native).toBe(globalThis.sessionStorage);
  adapter.dispose();
});

test("a value lands in the area as its JSON text and reads back decoded", () => {
  const adapter = sessionStorage();
  const value = { nested: [1, "two", null] };

  adapter.set(KEY, value);

  expect(globalThis.sessionStorage.getItem(KEY)).toBe(JSON.stringify(value));
  expect(adapter.get(KEY)).toEqual(value);
  adapter.dispose();
});

test("available and format are the application's when given", () => {
  const adapter = sessionStorage({
    available: () => false,
    format: {
      stringify: (stored: unknown) => `!${JSON.stringify(stored)}`,
      parse: (text: string) => JSON.parse(text.slice(1)),
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(globalThis.sessionStorage.getItem(KEY)).toBe('!"dark"');
  expect(adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("a refused write propagates to the caller", () => {
  const adapter = sessionStorage();
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
  const adapter = sessionStorage();
  const { changes, stop } = observe(adapter);

  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.sessionStorage,
  });

  expect(changes).toEqual([{ key: KEY, value: "dark" }]);

  stop();
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("light"),
    storageArea: globalThis.sessionStorage,
  });

  expect(changes).toHaveLength(1);
  adapter.dispose();
});

test("an observer ignores the other web storage", () => {
  const adapter = sessionStorage();
  const { changes } = observe(adapter);
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.localStorage,
  });

  expect(
    changes,
    "both storages fire on the same window, so only the storage area tells them apart",
  ).toEqual([]);
  adapter.dispose();
});

test("an observer reports a clear as { key: null }", () => {
  const adapter = sessionStorage();
  const { changes } = observe(adapter);
  storageEvent({ key: null, storageArea: globalThis.sessionStorage });

  expect(changes).toEqual([{ key: null }]);
  adapter.dispose();
});

test("an observer falls silent after dispose", () => {
  const adapter = sessionStorage();
  const { changes } = observe(adapter);
  adapter.dispose();
  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.sessionStorage,
  });

  expect(changes).toEqual([]);
});

test("blocked site data reads as an absent platform", () => {
  vi.spyOn(globalThis, "sessionStorage", "get").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });

  const adapter = sessionStorage();

  expect(adapter.native).toBeNull();
  expect(adapter.get(KEY)).toBeUndefined();
  expect(() => adapter.set(KEY, "value")).toThrow(/no sessionStorage/);
  expect(() => adapter.remove(KEY)).toThrow(/no sessionStorage/);
  expect(() => observe(adapter).stop()).not.toThrow();
  adapter.dispose();
});

test("a silo persists through this adapter and rehydrates from it", () => {
  const schema = { theme: value<string>({ fallback: "light" }) };
  const silo = new Silo({
    storages: { default: { adapters: [sessionStorage()], schema: schema } },
  });

  silo.value("theme").set("dark");

  expect(
    globalThis.sessionStorage.getItem(KEY),
    "the core composes the physical key and the adapter must store it untouched",
  ).toBe('"dark"');

  const reloaded = new Silo({
    storages: { default: { adapters: [sessionStorage()], schema: schema } },
  });

  expect(
    reloaded.value("theme").get(),
    "a sync adapter hydrates inside value(), so the first read already sees the stored value",
  ).toBe("dark");
  silo.dispose();
  reloaded.dispose();
});

test("a silo applies a change from a context sharing the session", () => {
  const silo = new Silo({
    storages: {
      default: {
        adapters: [sessionStorage()],
        schema: { theme: value<string>({ fallback: "light" }) },
      },
    },
  });
  const theme = silo.value("theme");

  storageEvent({
    key: KEY,
    newValue: JSON.stringify("dark"),
    storageArea: globalThis.sessionStorage,
  });

  expect(theme.get()).toBe("dark");
  silo.dispose();
});

test("dispose unregisters browser listeners and repeated stops do nothing", () => {
  const added = vi.spyOn(globalThis, "addEventListener");
  const removed = vi.spyOn(globalThis, "removeEventListener");
  const adapter = sessionStorage();
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
