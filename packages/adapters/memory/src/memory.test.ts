import { afterEach, expect, test, vi } from "vitest";
import { memory } from "src/memory";

const KEY = "silo:user";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the factory is cold and every adapter owns its own store", () => {
  const first = memory();
  const second = memory();

  expect(first.native.size).toBe(0);
  expect(first.native).not.toBe(second.native);

  first.set(KEY, { name: "ada" });

  expect(second.native.size).toBe(0);
  expect(second.get(KEY)).toBeUndefined();

  first.dispose();
  second.dispose();
});

test("mutating the object passed to set does not change what get returns", () => {
  const adapter = memory();
  const user = { name: "ada" };

  adapter.set(KEY, user);
  user.name = "grace";

  expect(adapter.get(KEY)).toEqual({ name: "ada" });

  adapter.dispose();
});

test("every read hands back a fresh copy, so a consumer cannot reach the store", () => {
  const adapter = memory();

  adapter.set(KEY, { name: "ada" });
  const first = adapter.get(KEY);
  const second = adapter.get(KEY);

  expect(first).toEqual({ name: "ada" });
  expect(first).not.toBe(second);
  expect(first).not.toBe(adapter.native.get(KEY));

  adapter.dispose();
});

test("a value structuredClone refuses fails loudly instead of being stored", () => {
  const adapter = memory();

  expect(() => adapter.set(KEY, { handleClick: () => undefined })).toThrow();
  expect(adapter.get(KEY)).toBeUndefined();

  adapter.dispose();
});

test("a runtime without structuredClone, such as Hermes, still stores a copy", () => {
  vi.stubGlobal("structuredClone", undefined);
  const adapter = memory();
  const role = { name: "admin" };

  adapter.set(KEY, {
    roles: new Set([role]),
    grants: new Map([["docs", role]]),
  });
  role.name = "guest";

  expect(adapter.get(KEY)).toEqual({
    roles: new Set([{ name: "admin" }]),
    grants: new Map([["docs", { name: "admin" }]]),
  });
  expect(adapter.get(KEY)).not.toBe(adapter.get(KEY));

  adapter.dispose();
});

test("a runtime without structuredClone refuses a function the same way", () => {
  vi.stubGlobal("structuredClone", undefined);
  const adapter = memory();

  expect(() => adapter.set(KEY, { handleClick: () => undefined })).toThrow(
    expect.objectContaining({ name: "DataCloneError" }),
  );
  expect(adapter.get(KEY)).toBeUndefined();

  adapter.dispose();
});

test("native is the store itself, and reading it bypasses the clone", () => {
  const adapter = memory();
  const user = { name: "ada" };

  adapter.set(KEY, user);

  expect(adapter.native.get(KEY)).not.toBe(user);
  expect(adapter.native.get(KEY)).toBe(adapter.native.get(KEY));

  adapter.native.set(KEY, { name: "seeded" });

  expect(adapter.get(KEY)).toEqual({ name: "seeded" });

  adapter.dispose();
});

test("dispose empties the store it held without replacing it", () => {
  const adapter = memory();
  const store = adapter.native;

  adapter.set(KEY, "value");
  adapter.dispose();

  expect(adapter.native).toBe(store);
  expect(store.size).toBe(0);
});

test("an available override decides the probe, so a candidate list can be gated", () => {
  const gated = memory({ available: () => false });
  const plain = memory();

  expect(gated.available()).toBe(false);
  expect(plain.available()).toBe(true);
  gated.dispose();
  plain.dispose();
});
