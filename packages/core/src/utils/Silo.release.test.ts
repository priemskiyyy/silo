import { expect, test, vi } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { deferred } from "src/utils/common/deferred";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const schema = { count: value({ fallback: 0 }) };
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

test("release covers a scope's physical aliases and descendants across storages", async () => {
  const primary = createMockAdapter();
  const secondary = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: { adapters: [primary.adapter], schema },
      secure: { adapters: [secondary.adapter], namespace: "", schema },
    },
  });
  const account = silo.scope("users").scope("7");
  const count = account.value("count");
  const child = account.scope("documents:1").value("count");
  const secure = account.value("secure.count");
  const neighbor = silo.scope("users:70").value("count");
  const root = silo.value("count");
  count.set(1);
  child.set(2);
  secure.set(3);
  const changed = vi.fn();
  count.subscribe(changed);
  const calls = primary.calls.length + secondary.calls.length;

  await silo.scope("users:7").release();

  expect(primary.calls.length + secondary.calls.length).toBe(calls);
  expect(
    silo.diagnostics.get().records.map((record) => record.physicalKey),
  ).toEqual(["silo:users:70:count", "silo:count"]);
  count.set(10);
  child.remove();
  secure.set(30);
  primary.emit({ key: "silo:users:7:count", value: 20 });
  expect(changed).not.toHaveBeenCalled();
  expect(count.get()).toBe(1);
  expect(child.get()).toBe(2);
  expect(secure.get()).toBe(3);
  expect(primary.store.get("silo:users:7:count")).toBe(1);
  expect(secondary.store.get("users:7:count")).toBe(3);
  expect(silo.scope("users:70").value("count")).toBe(neighbor);
  expect(silo.value("count")).toBe(root);
  const fresh = account.value("count");
  expect(fresh).not.toBe(count);
  expect(fresh.get()).toBe(1);
  fresh.set(4);
  expect(count.get()).toBe(1);
  expect(fresh.get()).toBe(4);
  expect(primary.disposeCount()).toBe(0);
  silo.dispose();
});

test.each(["silo", ""])(
  "root release leaves storage alive without creating demand (namespace: %j)",
  async (namespace) => {
    const mock = createMockAdapter();
    const silo = new Silo({
      namespace,
      storages: { default: { adapters: [mock.adapter], schema } },
    });
    await silo.scope("unused").release();
    expect(mock.calls).toEqual([]);
    silo.value("count").set(5);
    silo.scope("account").value("count").set(6);
    await silo.release();
    await silo.release();
    expect(silo.diagnostics.get().records).toEqual([]);
    expect(mock.store.size).toBe(2);
    expect(silo.value("count").get()).toBe(5);
    silo.dispose();
    await expect(silo.release()).rejects.toThrow("disposed");
    await expect(silo.flush()).rejects.toThrow("disposed");
  },
);

test("release waits for writes accepted while an earlier barrier settles", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const scope = silo.scope("account");
  const count = scope.value("count");
  count.set(1);
  const first = count.flush();
  first.then(() => count.set(2));
  const released = vi.fn();
  const release = scope.release().then(released);
  mock.calls.find((call) => call.operation === "set")?.settle();
  await macrotask();
  expect(released).not.toHaveBeenCalled();
  const child = scope.scope("child").value("count");
  child.set(3);
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await release;
  expect(mock.store.get("silo:account:count")).toBe(2);
  expect(mock.store.get("silo:account:child:count")).toBe(3);
  expect(silo.diagnostics.get().records).toEqual([]);
  count.set(4);
  expect(count.get()).toBe(2);
  silo.dispose();
});

test("a failed release keeps every record available for recovery", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const scope = silo.scope("account");
  const count = scope.value("count");
  const child = scope.scope("child").value("count");
  count.set(1);
  const release = scope.release();
  const failed = expect(release).rejects.toThrow("quota");
  mock.calls.find((call) => call.operation === "set")?.fail(new Error("quota"));
  await failed;
  expect(scope.value("count")).toBe(count);
  expect(scope.scope("child").value("count")).toBe(child);
  expect(count.get()).toBe(1);
  count.set(2);
  const retry = scope.release();
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await retry;
  expect(silo.diagnostics.get().records).toEqual([]);
  expect(mock.store.get("silo:account:count")).toBe(2);
  silo.dispose();
});

test("releasing a cold record rejects hydration and ignores a late read", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:account:count", 9);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const scope = silo.scope("account");
  const count = scope.value("count");
  const hydrated = expect(count.hydrated()).rejects.toThrow("released");
  await scope.release();
  await hydrated;
  await expect(count.hydrated()).rejects.toThrow("released");
  mock.calls[0]?.settle();
  await macrotask();
  expect(count.get()).toBe(0);
  const fresh = scope.value("count");
  mock.calls.at(-1)?.settle();
  await fresh.hydrated();
  expect(fresh.get()).toBe(9);
  expect(count.get()).toBe(0);
  silo.dispose();
});

test("disposal interrupts a pending release and concurrent releases are harmless", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const scope = silo.scope("account");
  scope.value("count").set(1);
  const first = expect(scope.release()).rejects.toThrow("disposed");
  const second = expect(scope.release()).rejects.toThrow("disposed");
  silo.dispose();
  await Promise.all([first, second]);
  expect(silo.diagnostics.get().records).toEqual([]);
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await macrotask();
});

test("overlapping releases wait for shared writes and leave storage intact", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const scope = silo.scope("account");
  const child = scope.scope("child");
  child.value("count").set(7);
  const parentRelease = scope.release();
  const childRelease = child.release();
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await Promise.all([parentRelease, childRelease]);
  expect(silo.diagnostics.get().records).toEqual([]);
  expect(mock.store.get("silo:account:child:count")).toBe(7);
  silo.dispose();
});

test("release cancels only the old record's pending migration admission", async () => {
  const mock = createMockAdapter({ mode: "async" });
  const migration = deferred();
  mock.store.set("silo:account:count", 9);
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
    migrations: { 1: () => migration.promise },
  });
  const scope = silo.scope("account");
  const old = scope.value("count");
  const hydration = expect(old.hydrated()).rejects.toThrow("released");
  await scope.release();
  await hydration;
  const fresh = scope.value("count");
  const neighbor = silo.scope("neighbor").value("count");
  expect(fresh).not.toBe(old);
  expect(silo.status.get().state).toBe("migrating");

  migration.resolve();
  await silo.ready();
  await Promise.all([fresh.hydrated(), neighbor.hydrated()]);
  expect(fresh.get()).toBe(9);
  expect(neighbor.status.get().state).toBe("ready");
  expect(old.get()).toBe(0);
  expect(
    mock.calls.filter(
      (call) => call.operation === "get" && call.key === "silo:account:count",
    ),
  ).toHaveLength(1);
  silo.dispose();
});
