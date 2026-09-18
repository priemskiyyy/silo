import { expect, test, vi } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import type { StorageChange } from "@priemskiyyy/silo";
import { tauriStore } from "src/tauriStore";
import { fakeTauriStore } from "src/tauriStore.fixture";

const KEY = "silo:theme";

const observe = (adapter: ReturnType<typeof tauriStore>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe onChange");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the factory wraps the store it is given and touches nothing", async () => {
  const fake = fakeTauriStore();
  const get = vi.spyOn(fake.store, "get");
  const adapter = tauriStore({ store: fake.store });

  expect(adapter.name).toBe("tauri-store");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.store);
  expect(adapter.available()).toBe(true);
  expect(get).not.toHaveBeenCalled();
  expect(fake.listeners.size).toBe(0);

  await adapter.get(KEY);

  expect(get).toHaveBeenCalledWith(KEY);
  adapter.dispose();
});

test("values pass through the plugin's JSON, undefined is a removal, and null stays distinct", async () => {
  const fake = fakeTauriStore();
  const adapter = tauriStore({ store: fake.store });

  await adapter.set(KEY, { when: new Date(0), tags: [null] });

  expect(await adapter.get(KEY)).toEqual({
    when: "1970-01-01T00:00:00.000Z",
    tags: [null],
  });

  await adapter.set(KEY, null);

  expect(await adapter.get(KEY)).toBeNull();

  await adapter.set(KEY, undefined);

  expect(fake.entries.has(KEY)).toBe(false);
  expect(await adapter.get(KEY)).toBeUndefined();
  adapter.dispose();
});

test("an observer reports every change with its value, a deletion as undefined, own writes included", async () => {
  const fake = fakeTauriStore();
  const adapter = tauriStore({ store: fake.store });
  const { changes, stop } = observe(adapter);

  await fake.store.set(KEY, "dark");
  await adapter.set(KEY, "light");
  await fake.store.delete(KEY);

  expect(changes).toEqual([
    { key: KEY, value: "dark" },
    { key: KEY, value: "light" },
    { key: KEY, value: undefined },
  ]);

  stop();
  await settle();
  await fake.store.set(KEY, "late");

  expect(changes).toHaveLength(3);
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("a stop before the subscription settles drops what lands in between and unlistens after", async () => {
  const fake = fakeTauriStore();
  let subscribe: () => void = () => undefined;
  const store = {
    ...fake.store,
    // The real plugin subscribes over IPC, so the listener is live only later.
    onChange: (listener: (key: string, value: unknown) => void) =>
      new Promise<() => void>((resolve) => {
        subscribe = () => fake.store.onChange(listener).then(resolve);
      }),
  };
  const adapter = tauriStore({ store });
  const { changes, stop } = observe(adapter);

  stop();
  subscribe();
  await settle();
  await fake.store.set(KEY, "dark");

  expect(changes).toEqual([]);
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("dispose releases every observer still registered", async () => {
  const fake = fakeTauriStore();
  const adapter = tauriStore({ store: fake.store });
  const first = observe(adapter);
  const second = observe(adapter);

  adapter.dispose();
  await settle();
  await fake.store.set(KEY, "dark");

  expect(first.changes).toEqual([]);
  expect(second.changes).toEqual([]);
  expect(fake.listeners.size).toBe(0);
  expect(fake.entries.get(KEY)).toBe("dark");
});

test("a silo persists through the store and rereads it", async () => {
  const fake = fakeTauriStore();
  const storages = () => ({
    default: {
      adapters: [tauriStore({ store: fake.store })],
      schema: { theme: value({ fallback: "light" }) },
    },
  });
  const silo = new Silo({ storages: storages() });

  silo.value("theme").set("dark");
  await silo.flush();
  silo.dispose();

  const again = new Silo({ storages: storages() });
  const theme = again.value("theme");

  await theme.hydrated();

  expect(theme.get()).toBe("dark");
  again.dispose();
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const fake = fakeTauriStore();
  const gated = tauriStore({ store: fake.store, available: () => false });

  expect(gated.available()).toBe(false);
  gated.dispose();
});

test("a rejected subscription is handled before the observer is stopped", async () => {
  const fake = fakeTauriStore();
  vi.spyOn(fake.store, "onChange").mockRejectedValue(
    new Error("IPC unavailable"),
  );
  const adapter = tauriStore({ store: fake.store });
  const { changes, stop } = observe(adapter);

  await settle();
  expect(changes).toEqual([
    { key: null, error: { cause: new Error("IPC unavailable") } },
  ]);
  stop();
  adapter.dispose();
  await settle();
});

test("a subscription is released only once", async () => {
  const fake = fakeTauriStore();
  const release = vi.fn();
  vi.spyOn(fake.store, "onChange").mockResolvedValue(release);
  const adapter = tauriStore({ store: fake.store });
  const { stop } = observe(adapter);

  stop();
  stop();
  adapter.dispose();
  await settle();

  expect(release).toHaveBeenCalledOnce();
});
