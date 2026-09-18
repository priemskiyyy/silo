import { expect, test, vi } from "vitest";
import type { StorageChange } from "@priemskiyyy/silo";
import { Silo, value } from "@priemskiyyy/silo";
import { icloud } from "src/icloud";
import { createFakeCloudStore } from "src/icloud.fixture";

const KEY = "silo:theme";

const observe = (adapter: ReturnType<typeof icloud>) => {
  const changes: StorageChange[] = [];

  if (typeof adapter.observe !== "function") {
    throw new Error("the adapter must observe the remote change notification");
  }

  return { changes, stop: adapter.observe((change) => changes.push(change)) };
};

test("the factory wraps the module it is given and touches nothing at construction", () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });

  expect(adapter.name).toBe("icloud");
  expect(adapter.mode).toBe("async");
  expect(adapter.native).toBe(fake.module);
  expect(adapter.available()).toBe(true);
  expect(fake.registered()).toBe(false);
  expect(fake.listeners.size).toBe(0);
  adapter.dispose();
});

test("available and format come from the options, so Android can fall through to the next candidate", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({
    store: fake.module,
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

test("keys lists every key iCloud holds, exactly as written", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });

  await adapter.set(KEY, 1);
  await adapter.set("__proto__", 2);
  fake.store.set("other-app:setting", "true");

  expect(await adapter.keys?.()).toEqual([
    KEY,
    "__proto__",
    "other-app:setting",
  ]);
  adapter.dispose();
});

test("observing registers the native notification once and reports each changed key with its value read back", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });
  const first = observe(adapter);
  const second = observe(adapter);

  expect(fake.registered()).toBe(true);
  expect(fake.listeners.size).toBe(2);

  fake.store.set(KEY, JSON.stringify("dark"));
  fake.store.delete("silo:visits");
  fake.remote({ reason: 0, changedKeys: [KEY, "silo:visits"] });
  await vi.waitFor(() => expect(first.changes).toHaveLength(2));

  expect(first.changes).toEqual([
    { key: KEY, value: "dark" },
    { key: "silo:visits", value: undefined },
  ]);
  expect(second.changes).toEqual(first.changes);
  adapter.dispose();
});

test("a remote change naming no keys is the coarse report, and a malformed value reports its error", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });
  const { changes } = observe(adapter);

  fake.remote({ reason: 3 });
  fake.store.set(KEY, "not json");
  fake.store.set("silo:visits", "4");
  fake.remote({ reason: 0, changedKeys: [KEY, "silo:visits"] });
  await vi.waitFor(() =>
    expect(changes).toContainEqual({ key: "silo:visits", value: 4 }),
  );

  expect(changes).toEqual([
    { key: null },
    { key: KEY, error: { cause: expect.any(SyntaxError) } },
    { key: "silo:visits", value: 4 },
  ]);
  adapter.dispose();
});

test("stop releases one listener, dispose releases the rest and the native notification, and nothing lands after either", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });
  const first = observe(adapter);
  const second = observe(adapter);

  first.stop();

  expect(fake.listeners.size).toBe(1);
  expect(fake.registered()).toBe(true);

  adapter.dispose();

  expect(fake.listeners.size).toBe(0);
  expect(fake.registered()).toBe(false);

  // Raised on a listener the fake still holds, the way a late native event
  // would be; both observers are stopped and drop it.
  fake.store.set(KEY, JSON.stringify("late"));
  fake.remote({ reason: 0, changedKeys: [KEY] });
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(first.changes).toEqual([]);
  expect(second.changes).toEqual([]);
});

test("a change from another device updates a silo value in place", async () => {
  const fake = createFakeCloudStore();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [icloud({ store: fake.module })],
        schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
      },
    },
  });
  const theme = silo.value("theme");

  await theme.hydrated();
  expect(theme.get()).toBe("light");

  fake.store.set(KEY, JSON.stringify("dark"));
  fake.remote({ reason: 0, changedKeys: [KEY] });
  await vi.waitFor(() => expect(theme.get()).toBe("dark"));

  silo.dispose();
});

test.each(["throw", "reject"])(
  "a remote read that fails by %s reports its cause",
  async (kind) => {
    const fake = createFakeCloudStore();
    const adapter = icloud({ store: fake.module });
    const { changes } = observe(adapter);
    const failure = new Error("cloud unavailable");
    vi.spyOn(fake.module, "kvGetItem").mockImplementation(() => {
      if (kind === "throw") {
        throw failure;
      }
      return Promise.reject(failure);
    });
    expect(() => fake.remote({ reason: 0, changedKeys: [KEY] })).not.toThrow();
    await vi.waitFor(() =>
      expect(changes).toEqual([{ key: KEY, error: { cause: failure } }]),
    );
    adapter.dispose();
  },
);

test("a failed remote read finishing after stop stays silent", async () => {
  const fake = createFakeCloudStore();
  const adapter = icloud({ store: fake.module });
  const { changes, stop } = observe(adapter);
  let fail: (cause: unknown) => void = () => {};
  vi.spyOn(fake.module, "kvGetItem").mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  fake.remote({ reason: 0, changedKeys: [KEY] });
  stop();
  fail(new Error("late failure"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(changes).toEqual([]);
  adapter.dispose();
});
