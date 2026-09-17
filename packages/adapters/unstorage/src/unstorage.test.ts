import { expect, test } from "vitest";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { unstorage } from "src/unstorage";

const list = (adapter: ReturnType<typeof unstorage>) => {
  if (typeof adapter.keys !== "function") {
    throw new Error("the adapter must list its keys");
  }

  return adapter.keys();
};

const setup = () => {
  const storage = createStorage({ driver: memoryDriver() });

  return { storage, adapter: unstorage({ storage }) };
};

test("keys reach unstorage percent encoded and come back as the core composed them", async () => {
  const { storage, adapter } = setup();
  const key = "silo:users/7?draft=1";

  await adapter.set(key, "value");

  // unstorage would have turned the slash into a colon and dropped the query.
  expect(await storage.getKeys()).toEqual([encodeURIComponent(key)]);
  expect(await list(adapter)).toEqual([key]);
  expect(await adapter.get(key)).toBe("value");
  adapter.dispose();
});

test("a string that looks like a number stays a string", async () => {
  const { adapter } = setup();

  await adapter.set("silo:code", "42");
  await adapter.set("silo:flag", "true");

  // unstorage parses stored strings on read; the JSON envelope keeps them.
  expect(await adapter.get("silo:code")).toBe("42");
  expect(await adapter.get("silo:flag")).toBe("true");
  adapter.dispose();
});

test("setting undefined removes the key", async () => {
  const { storage, adapter } = setup();

  await adapter.set("silo:theme", "dark");
  await adapter.set("silo:theme", undefined);

  expect(await adapter.get("silo:theme")).toBeUndefined();
  expect(await storage.getKeys()).toEqual([]);
  adapter.dispose();
});

test("a value another writer stored without the JSON envelope still reads", async () => {
  const { storage, adapter } = setup();

  await storage.setItem(encodeURIComponent("silo:plain"), "plain text");
  await storage.setItem("not%zzencoded", "foreign");

  expect(await adapter.get("silo:plain")).toBe("plain text");
  // A foreign key that is not percent encoded is listed as it is.
  expect(await list(adapter)).toEqual(["silo:plain", "not%zzencoded"]);
  adapter.dispose();
});

test("the probe is the application's when given", () => {
  const { adapter } = setup();
  const gated = unstorage({
    storage: adapter.native,
    available: () => false,
  });

  expect(adapter.available()).toBe(true);
  expect(gated.available()).toBe(false);
  adapter.dispose();
  gated.dispose();
});

test("native is the storage, and dispose leaves its data alone", async () => {
  const { storage, adapter } = setup();

  await adapter.set("silo:theme", "dark");
  adapter.dispose();

  expect(adapter.native).toBe(storage);
  expect(await storage.getItem(encodeURIComponent("silo:theme"))).toBe("dark");
});
