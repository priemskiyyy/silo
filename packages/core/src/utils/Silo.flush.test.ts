import { expect, test } from "vitest";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { Silo } from "src/utils/Silo";
import { value } from "src/utils/value";

const schema = { count: value({ fallback: 0 }) };

test("flush creates no demand and does not wait for clean records to hydrate", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  await silo.flush();
  expect(mock.calls).toEqual([]);
  expect(silo.diagnostics.get().records).toEqual([]);

  const count = silo.value("count");
  await silo.flush();
  expect(count.status.get().state).toBe("hydrating");
  expect(mock.calls).toHaveLength(1);
  expect(mock.calls[0]?.pending).toBe(true);
  silo.dispose();
});

test("flush waits for captured writes and excludes a later write to a clean record", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema } },
  });
  const first = silo.scope("first").value("count");
  const second = silo.scope("second").value("count");
  first.set(1);
  const flushed = silo.flush();
  second.set(2);
  mock.calls
    .find((call) => call.operation === "set" && call.key === "silo:first:count")
    ?.settle();
  await flushed;
  expect(mock.store.get("silo:first:count")).toBe(1);
  expect(mock.store.has("silo:second:count")).toBe(false);

  const next = silo.flush();
  const failure = new Error("quota");
  const rejected = expect(next).rejects.toBe(failure);
  mock.calls
    .find(
      (call) => call.operation === "set" && call.key === "silo:second:count",
    )
    ?.fail(failure);
  await rejected;
  await expect(silo.flush()).rejects.toBe(failure);
  second.set(3);
  const recovered = silo.flush();
  mock.calls.filter((call) => call.pending).forEach((call) => call.settle());
  await recovered;
  expect(mock.store.get("silo:second:count")).toBe(3);
  silo.dispose();
});
