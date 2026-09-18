import { DatabaseSync } from "node:sqlite";
import { Silo, value } from "@priemskiyyy/silo";
import { expect, test } from "vitest";
import { sqlite } from "src/sqlite";
import type { SqliteDatabase } from "src/types/SqliteDatabase";

const KEY = "silo:theme";

const tables = (database: DatabaseSync) =>
  database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

test("node:sqlite's DatabaseSync satisfies the structural type without a cast", () => {
  const database: SqliteDatabase = new DatabaseSync(":memory:");

  expect(sqlite({ database }).native).toBe(database);
});

test("the factory is cold: the table exists only after the first operation", () => {
  const database = new DatabaseSync(":memory:");
  const adapter = sqlite({ database });

  expect(tables(database)).toEqual([]);

  adapter.set(KEY, "dark");

  expect(tables(database)).toEqual(["silo"]);
  adapter.dispose();
});

test("a row is the physical key and the value's text, in the table the store was given", () => {
  const database = new DatabaseSync(":memory:");
  const adapter = sqlite({ database });

  adapter.set(KEY, { nested: [1, "two", null] });

  expect(database.prepare("SELECT key, value FROM silo").all()).toEqual([
    { key: KEY, value: '{"nested":[1,"two",null]}' },
  ]);
  adapter.dispose();
});

test("a value that is not text was written past this adapter and throws by name", () => {
  const database = new DatabaseSync(":memory:");
  const adapter = sqlite({ database });

  adapter.set("silo:ok", 1);
  // TEXT affinity turns a number into text, so only a blob stays non-text.
  database
    .prepare("INSERT INTO silo (key, value) VALUES (?, ?)")
    .run(KEY, new Uint8Array([1, 2, 3]));

  expect(() => adapter.get(KEY)).toThrow(
    `The sqlite adapter found something that is not text under "${KEY}" in "silo".`,
  );
  adapter.dispose();
});

test("the probe and the text format are the application's when given", () => {
  const database = new DatabaseSync(":memory:");
  const adapter = sqlite({
    database,
    available: () => false,
    format: {
      stringify: (value) => `wrapped:${JSON.stringify(value)}`,
      parse: (text) => JSON.parse(text.replace(/^wrapped:/u, "")),
    },
  });

  adapter.set(KEY, "dark");

  expect(adapter.available()).toBe(false);
  expect(database.prepare("SELECT value FROM silo").get()).toEqual({
    value: 'wrapped:"dark"',
  });
  expect(adapter.get(KEY)).toBe("dark");
  adapter.dispose();
});

test("the table name is validated before it reaches SQL, and a custom one is used", () => {
  const database = new DatabaseSync(":memory:");

  expect(() => sqlite({ database, table: "silo; DROP TABLE x" })).toThrow(
    'The sqlite adapter cannot use the table "silo; DROP TABLE x"',
  );
  expect(() => sqlite({ database, table: "1st" })).toThrow(
    "a table name is letters, digits and underscores",
  );

  const adapter = sqlite({ database, table: "preferences_v2" });
  adapter.set(KEY, "dark");

  expect(tables(database)).toEqual(["preferences_v2"]);
  adapter.dispose();
});

test("values survive a new adapter over the same connection, and dispose leaves it open", () => {
  const database = new DatabaseSync(":memory:");
  const first = sqlite({ database });

  first.set(KEY, "dark");
  first.dispose();

  const second = sqlite({ database });

  expect(second.get(KEY)).toBe("dark");
  expect(second.keys?.()).toEqual([KEY]);
  expect(database.isOpen).toBe(true);
  second.dispose();
});

test("a silo persists through this adapter and rehydrates from it synchronously", () => {
  const database = new DatabaseSync(":memory:");
  const Schema = { theme: value<"light" | "dark">({ fallback: "light" }) };
  const writer = new Silo({
    storages: { default: { adapters: [sqlite({ database })], schema: Schema } },
  });

  writer.value("theme").set("dark");
  writer.dispose();

  const reader = new Silo({
    storages: { default: { adapters: [sqlite({ database })], schema: Schema } },
  });

  expect(reader.value("theme").get()).toBe("dark");
  reader.dispose();
});
