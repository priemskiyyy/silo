import { expect, test } from "vitest";
import { Keyspace } from "src/utils/internal/Keyspace";

test("key mappings cover migration metadata and reject empty or irreversible output", () => {
  expect(
    () =>
      new Keyspace({
        namespace: "silo",
        keys: { encode: () => "", decode: () => undefined },
      }),
  ).toThrow("non-empty string");
  expect(
    () =>
      new Keyspace({
        namespace: "silo",
        keys: { encode: () => "metadata", decode: () => "other" },
      }),
  ).toThrow("keys.decode must reverse keys.encode");
  const keyspace = new Keyspace({
    namespace: "",
    keys: {
      encode: (key) => key.replaceAll(":", "."),
      decode: (key) => key.replaceAll(".", ":"),
    },
  });
  expect(keyspace.version).toBe("..version");
  expect(keyspace.relative("..version")).toBeNull();
  expect(() => keyspace.physical([":"], "version")).toThrow("reserved");
});

test("migration enumeration excludes physical aliases that do not round trip", () => {
  const keyspace = new Keyspace({
    namespace: "silo",
    keys: {
      encode: (key) => `mapped:${key}`,
      decode: (key) =>
        key.startsWith("mapped:") ? key.slice(7) : "silo:theme",
    },
  });
  expect(keyspace.relative("mapped:silo:theme")).toBe("theme");
  expect(keyspace.relative("alias")).toBeNull();
});

test("physical keys compose with a single separator and the namespace first", () => {
  const keyspace = new Keyspace({ namespace: "silo" });

  expect(keyspace.physical([], "theme")).toBe("silo:theme");
  expect(keyspace.physical(["users:7"], "theme")).toBe("silo:users:7:theme");
  expect(keyspace.physical(["users:7", "docs:3"], "theme")).toBe(
    "silo:users:7:docs:3:theme",
  );
});

test("an empty namespace is dropped from the join rather than left as a leading separator", () => {
  const shared = new Keyspace({ namespace: "" });

  expect(shared.physical([], "theme")).toBe("theme");
  expect(shared.physical(["a"], "b")).toBe("a:b");
  // The one documented collision: the same key as namespace "a" with key "b".
  expect(new Keyspace({ namespace: "a" }).physical([], "b")).toBe("a:b");
});

test("the version record sits behind an empty segment no value key can reach", () => {
  expect(new Keyspace({ namespace: "silo" }).version).toBe("silo::version");
  expect(new Keyspace({ namespace: "" }).version).toBe("::version");
});

test("the empty namespace cannot compose a value at its version address", () => {
  const keyspace = new Keyspace({ namespace: "" });

  expect(() => keyspace.physical([":"], "version")).toThrow("reserved");
  expect(() => keyspace.physical([], "::version")).toThrow("reserved");
  expect(keyspace.physical([":"], "theme")).toBe("::theme");
});

test("relative strips the prefix and hides everything outside the namespace", () => {
  const keyspace = new Keyspace({ namespace: "silo" });

  expect(keyspace.relative("silo:theme")).toBe("theme");
  expect(keyspace.relative("silo:users:7:theme")).toBe("users:7:theme");
  expect(keyspace.relative("silo::version")).toBeNull();
  expect(keyspace.relative("other:theme")).toBeNull();
  expect(keyspace.relative("silo")).toBeNull();
  expect(new Keyspace({ namespace: "" }).relative("anything:at:all")).toBe(
    "anything:at:all",
  );
});

test("each part is validated where it is written", () => {
  expect(() => new Keyspace({ namespace: "a:b" })).toThrow(
    'A Silo namespace must not contain ":", received "a:b".',
  );
  expect(() => new Keyspace({ namespace: "" })).not.toThrow();

  expect(() => Keyspace.assertKey("")).toThrow(
    "A Silo schema key must not be empty.",
  );
  expect(() => Keyspace.assertKey("a:b")).toThrow(
    'A Silo schema key must not contain ":" or ".", received "a:b".',
  );
  expect(() => Keyspace.assertKey("a.b")).toThrow(
    'A Silo schema key must not contain ":" or ".", received "a.b".',
  );
  expect(() => Keyspace.assertSegment("")).toThrow(
    "A Silo scope segment must not be empty.",
  );
  expect(() => Keyspace.assertSegment("users:7")).not.toThrow();
});
