import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import type { StorageChange } from "@priemskiyyy/silo";
import { chromeStorage } from "src/chromeStorage";
import { fakeArea } from "src/fakeArea.fixture";

const KEY = "silo:theme";

const observe = (adapter: ReturnType<typeof chromeStorage>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe onChanged");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("the factory wraps the area it is given and touches nothing", async () => {
  const fake = fakeArea();
  const get = vi.spyOn(fake.area, "get");
  const adapter = chromeStorage({ area: fake.area });

  expect(adapter.name).toBe("chrome-storage");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.area);
  expect(adapter.available()).toBe(true);
  expect(get).not.toHaveBeenCalled();
  expect(fake.listeners.size).toBe(0);

  await adapter.get(KEY);

  expect(get).toHaveBeenCalledWith(KEY);
  adapter.dispose();
});

test("values pass through untouched and undefined is a removal", async () => {
  const fake = fakeArea();
  const adapter = chromeStorage({ area: fake.area });
  const stored = { nested: [1, "two", null] };

  await adapter.set(KEY, stored);

  expect(fake.store.get(KEY)).toBe(stored);
  expect(await adapter.get(KEY)).toBe(stored);

  await adapter.set(KEY, undefined);

  expect(fake.store.has(KEY)).toBe(false);
  expect(await adapter.get(KEY)).toBeUndefined();
  adapter.dispose();
});

test("__proto__ is an ordinary key, absent or present", async () => {
  const fake = fakeArea();
  const adapter = chromeStorage({ area: fake.area });

  expect(await adapter.get("__proto__")).toBeUndefined();

  await adapter.set("__proto__", 1);

  expect(await adapter.get("__proto__")).toBe(1);
  expect(await adapter.keys?.()).toEqual(["__proto__"]);
  adapter.dispose();
});

test("an observer reports every changed key, a removal as undefined", async () => {
  const fake = fakeArea();
  const adapter = chromeStorage({ area: fake.area });
  const { changes, stop } = observe(adapter);

  await fake.area.set({ [KEY]: "dark", other: 1 });
  await fake.area.remove(KEY);
  await vi.waitFor(() => expect(changes).toHaveLength(3));

  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: "other", value: 1 },
    { key: KEY, value: undefined },
  ]);

  stop();
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("own writes echo back through onChanged and dispose releases every listener", async () => {
  const fake = fakeArea();
  const adapter = chromeStorage({ area: fake.area });
  const { changes } = observe(adapter);
  observe(adapter);

  await adapter.set(KEY, "dark");
  await vi.waitFor(() => expect(changes).toHaveLength(1));

  expect(fake.listeners.size).toBe(2);
  adapter.dispose();
  expect(fake.listeners.size).toBe(0);

  await fake.area.set({ [KEY]: "light" });
  await new Promise((resolve) => setTimeout(resolve, 5));

  expect(changes).toEqual([{ key: KEY, value: "dark" }]);
});

test("a silo persists through this adapter and picks up another context's write", async () => {
  const fake = fakeArea();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [chromeStorage({ area: fake.area })],
        schema: { theme: value<string>({ fallback: "light" }) },
      },
    },
  });
  const theme = silo.value("theme");

  await theme.hydrated();
  theme.set("dark");
  await theme.flush();

  expect(fake.store.get(KEY)).toBe("dark");

  await fake.area.set({ [KEY]: "system" });
  await vi.waitFor(() => expect(theme.get()).toBe("system"));
  silo.dispose();
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const fake = fakeArea();
  const gated = chromeStorage({ area: fake.area, available: () => false });

  expect(gated.available()).toBe(false);
  gated.dispose();
});
