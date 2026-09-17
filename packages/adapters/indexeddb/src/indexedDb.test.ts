import { expect, test, vi } from "vitest";
import type { StorageChange } from "@priemskiyyy/silo";
import { indexedDb } from "src/indexedDb";

const watchTransactions = (database: IDBDatabase) => {
  const created: IDBTransaction[] = [];
  const open = database.transaction.bind(database);

  vi.spyOn(database, "transaction").mockImplementation((names, mode) => {
    const transaction = open(names, mode);
    created.push(transaction);

    return transaction;
  });

  return created;
};

const openRaw = (name: string, version?: number) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => request.result.createObjectStore("other");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

test("the factory touches nothing until the first operation", async () => {
  const open = vi.spyOn(indexedDB, "open");
  const adapter = indexedDb({ name: "cold" });

  expect(adapter.name).toBe("indexeddb");
  expect(adapter.native.name).toBe("cold");
  expect(adapter.native.version).toBeUndefined();
  expect(open).not.toHaveBeenCalled();

  await adapter.get("key");

  expect(open).toHaveBeenCalledTimes(1);
  adapter.dispose();
});

test("concurrent operations share one connection and one transaction each", async () => {
  const open = vi.spyOn(indexedDB, "open");
  const adapter = indexedDb({ name: "concurrent" });
  const database = await adapter.native.database();
  const transactions = watchTransactions(database);

  await Promise.all([
    adapter.set("one", 1),
    adapter.set("two", 2),
    adapter.remove("three"),
  ]);

  expect(
    transactions.length,
    "every operation opens its own transaction, because one held across an await commits underneath the next operation",
  ).toBe(3);
  expect(new Set(transactions).size).toBe(3);
  expect(
    open,
    "the open promise is cached, not repeated per call",
  ).toHaveBeenCalledTimes(1);
  expect(await adapter.native.database()).toBe(database);
  expect(await adapter.get("two")).toBe(2);
  adapter.dispose();
});

test("a write resolves only once its transaction has completed", async () => {
  const adapter = indexedDb({ name: "durable" });
  const database = await adapter.native.database();
  const order: string[] = [];
  const open = database.transaction.bind(database);

  vi.spyOn(database, "transaction").mockImplementation((names, mode) => {
    const transaction = open(names, mode);
    transaction.addEventListener("complete", () => order.push("committed"));

    return transaction;
  });

  await adapter.set("key", "value");
  order.push("resolved");

  expect(
    order,
    "resolving on the request instead of the transaction makes flush() report durability the disk never took",
  ).toEqual(["committed", "resolved"]);
  adapter.dispose();
});

test("the object store is created on the upgrade and named by the option", async () => {
  const adapter = indexedDb({ name: "upgraded", store: "cabinet" });

  await adapter.set("key", "value");

  const database = await adapter.native.database();

  expect([...database.objectStoreNames]).toEqual(["cabinet"]);
  expect(await adapter.get("key")).toBe("value");
  adapter.dispose();
});

test("another connection's upgrade closes this one and the next call reopens", async () => {
  const adapter = indexedDb({ name: "versioned" });

  await adapter.set("key", "value");

  const first = await adapter.native.database();
  // Another tab upgrading blocks forever unless this connection closes itself.
  const upgraded = await openRaw("versioned", first.version + 1);

  expect(await adapter.get("key")).toBe("value");
  expect(
    await adapter.native.database(),
    "the closed handle must be dropped, or every later transaction throws on it",
  ).not.toBe(first);

  upgraded.close();
  adapter.dispose();
});

test("a Blob survives the round trip with its contents", async () => {
  const adapter = indexedDb({ name: "blobs" });

  await adapter.set("file", new Blob(["hello"], { type: "text/plain" }));

  const stored = await adapter.get("file");

  expect(stored).toBeInstanceOf(Blob);
  expect(stored instanceof Blob ? await stored.text() : null).toBe("hello");
  adapter.dispose();
});

test("a write reaches another adapter's observer and never the writer's own", async () => {
  const writer = indexedDb({ name: "shared" });
  const reader = indexedDb({ name: "shared" });
  const heard: StorageChange[] = [];
  const echoed: StorageChange[] = [];
  const stop = reader.observe?.((change) => heard.push(change));
  const stopEcho = writer.observe?.((change) => echoed.push(change));

  await writer.set("key", new Date(0));
  await vi.waitFor(() => expect(heard).toHaveLength(1));

  expect(heard).toEqual([{ key: "key", value: new Date(0) }]);

  await writer.remove("key");
  await vi.waitFor(() => expect(heard).toHaveLength(2));

  expect(heard.at(-1)).toEqual({ key: "key", value: undefined });
  expect(
    echoed,
    "BroadcastChannel does not deliver to the channel object that posted, so an adapter cannot hear itself",
  ).toEqual([]);

  stop?.();
  stopEcho?.();
  writer.dispose();
  reader.dispose();
});

test("adapters on different databases do not hear each other", async () => {
  const one = indexedDb({ name: "channel-one" });
  const two = indexedDb({ name: "channel-two" });
  const heard: StorageChange[] = [];
  const stop = two.observe?.((change) => heard.push(change));

  await one.set("key", "value");
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(heard).toEqual([]);
  stop?.();
  one.dispose();
  two.dispose();
});

test("dispose closes the connection and the channel, and stays idempotent", async () => {
  const adapter = indexedDb({ name: "disposal" });
  const stop = adapter.observe?.(() => undefined);

  await adapter.set("key", "value");

  const database = await adapter.native.database();
  const close = vi.spyOn(BroadcastChannel.prototype, "close");

  adapter.dispose();
  adapter.dispose();

  expect(
    close,
    "a leaked channel keeps listening for the page's life",
  ).toHaveBeenCalledTimes(1);
  await vi.waitFor(() =>
    expect(() => database.transaction("values", "readonly")).toThrow(),
  );
  await expect(adapter.native.database()).rejects.toThrow(/disposed/);
  stop?.();
});

test("single-tab sharing exposes no observer at all", async () => {
  const adapter = indexedDb({ name: "quiet", sharing: "single-tab" });
  const listener = indexedDb({ name: "quiet" });
  const heard: StorageChange[] = [];
  const stop = listener.observe?.((change) => heard.push(change));

  expect(
    adapter.observe,
    "an adapter that cannot report a change must not claim it observes",
  ).toBeUndefined();

  await adapter.set("key", "value");
  await new Promise((resolve) => setTimeout(resolve, 20));

  expect(
    heard,
    "single-tab sharing also stops announcing to the tabs that do observe",
  ).toEqual([]);
  stop?.();
  adapter.dispose();
  listener.dispose();
});

test("an environment without indexedDB reports it instead of hanging", async () => {
  vi.stubGlobal("indexedDB", undefined);

  const adapter = indexedDb({ name: "absent" });

  await expect(adapter.get("key")).rejects.toThrow(/no indexedDB/);
  adapter.dispose();
  vi.unstubAllGlobals();
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const gated = indexedDb({ available: () => false });
  const plain = indexedDb();

  expect(gated.available()).toBe(false);
  expect(plain.available()).toBe(true);
  gated.dispose();
  plain.dispose();
});
