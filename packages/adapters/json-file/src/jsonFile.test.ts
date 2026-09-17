import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { jsonFile } from "src/jsonFile";

let directory = "";

const list = (adapter: ReturnType<typeof jsonFile>) => {
  if (typeof adapter.keys !== "function") {
    throw new Error("the adapter must list its keys");
  }

  return adapter.keys();
};

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "silo-json-file-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

test("a missing file reads as empty, and the first write creates it with its parent folders", () => {
  const path = join(directory, "nested", "deeper", "state.json");
  const adapter = jsonFile({ path });

  expect(adapter.native.path).toBe(path);
  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(list(adapter)).toEqual([]);

  adapter.set("silo:theme", { mode: "dark" });

  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([
    ["silo:theme", { mode: "dark" }],
  ]);
  adapter.dispose();
});

test("an empty file reads as empty", () => {
  const path = join(directory, "state.json");
  writeFileSync(path, "");

  const adapter = jsonFile({ path });

  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(list(adapter)).toEqual([]);
  adapter.dispose();
});

test("a file that is not an entries array is refused by name, from the operation that touched it", () => {
  const invalid = join(directory, "invalid.json");
  const wrongShape = join(directory, "object.json");
  writeFileSync(invalid, "{ not json");
  writeFileSync(wrongShape, '{"silo:theme": "dark"}');

  expect(() => jsonFile({ path: invalid }).get("silo:theme")).toThrow(
    `The json-file adapter cannot read "${invalid}": it is not valid JSON.`,
  );
  expect(() => list(jsonFile({ path: wrongShape }))).toThrow(
    `The json-file adapter cannot read "${wrongShape}": expected a JSON array of [key, value] entries.`,
  );
});

test("values survive a new adapter over the same file, as JSON reads them", () => {
  const path = join(directory, "state.json");
  const first = jsonFile({ path });
  const when = new Date("2026-01-01T00:00:00.000Z");

  first.set("silo:when", when);
  first.set("silo:count", 3);
  first.dispose();

  const second = jsonFile({ path });

  // JSON has no Date, so the string is what both the file and the first
  // adapter's own read report.
  expect(first.native).toEqual({ path });
  expect(second.get("silo:when")).toBe(when.toISOString());
  expect(second.get("silo:count")).toBe(3);
  expect(list(second)).toEqual(["silo:when", "silo:count"]);
  second.dispose();
});

test("setting undefined removes the key instead of writing null", () => {
  const path = join(directory, "state.json");
  const adapter = jsonFile({ path });

  adapter.set("silo:theme", "dark");
  adapter.set("silo:theme", undefined);

  expect(adapter.get("silo:theme")).toBeUndefined();
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([]);
  adapter.dispose();
});

test("a read hands back a copy, so mutating it cannot drift the cache from the file", () => {
  const adapter = jsonFile({ path: join(directory, "state.json") });
  adapter.set("silo:user", { name: "eugene" });

  const read = adapter.get("silo:user");

  if (typeof read !== "object" || read === null) {
    throw new Error("expected the stored object");
  }

  Object.assign(read, { name: "someone else" });

  expect(adapter.get("silo:user")).toEqual({ name: "eugene" });
  adapter.dispose();
});

test("the probe is the application's when given", () => {
  const path = join(directory, "state.json");
  const adapter = jsonFile({ path, available: () => false });

  expect(adapter.available()).toBe(false);
  expect(jsonFile({ path }).available()).toBe(true);
  adapter.dispose();
});

test("dispose leaves the file and its data intact", () => {
  const path = join(directory, "state.json");
  const adapter = jsonFile({ path });
  adapter.set("silo:theme", "dark");

  adapter.dispose();

  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([
    ["silo:theme", "dark"],
  ]);
  expect(jsonFile({ path }).get("silo:theme")).toBe("dark");
});

test("failed writes leave the cached data unchanged and cannot leak into a later save", () => {
  const path = join(directory, "state.json");
  const temporary = `${path}.${process.pid}.tmp`;
  const adapter = jsonFile({ path });
  adapter.set("theme", "old");
  mkdirSync(temporary);
  const mutations: ((adapter: ReturnType<typeof jsonFile>) => void)[] = [
    (target) => target.set("theme", "new"),
    (target) => target.set("theme", undefined),
    (target) => target.remove("theme"),
    (target) => target.set("failed", "value"),
  ];

  for (const mutate of mutations) {
    expect(() => mutate(adapter)).toThrow();
    expect(adapter.get("theme")).toBe("old");
    expect(list(adapter)).toEqual(["theme"]);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([["theme", "old"]]);
  }

  rmSync(temporary, { recursive: true });
  adapter.set("saved", true);
  expect(JSON.parse(readFileSync(path, "utf8"))).toEqual([
    ["theme", "old"],
    ["saved", true],
  ]);
  adapter.dispose();
});
