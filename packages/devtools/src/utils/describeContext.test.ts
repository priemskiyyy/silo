import type { SiloDiagnosticEvent } from "@priemskiyyy/silo";
import { expect, test } from "vitest";
import { describeContext } from "src/utils/describeContext";

const event = (
  type: string,
  context: unknown,
  source: SiloDiagnosticEvent["source"] = "value",
): SiloDiagnosticEvent => ({
  source,
  type,
  storage: "default",
  key: "silo:theme",
  timestamp: 0,
  context,
});

test("summarises the fields silo contexts carry", () => {
  expect(
    describeContext(event("hydrate landed", { outcome: "absent" }), false)
      .summary,
  ).toBe("absent");
  expect(
    describeContext(
      event("write accepted", { kind: "set", revision: 2 }),
      false,
    ).summary,
  ).toBe("set");
  expect(
    describeContext(
      event("migration version", { version: 2 }, "migration"),
      false,
    ).summary,
  ).toBe("v2");
  expect(
    describeContext(
      event("outside dropped", { reason: "a local write is in flight" }),
      false,
    ).summary,
  ).toBe("a local write is in flight");
  expect(
    describeContext(
      event("record created", { path: "theme", segments: ["users:7"] }),
      false,
    ).summary,
  ).toBe("theme");
  expect(
    describeContext(event("store disposed", null, "store"), false).summary,
  ).toBe("");
});

test("redacts secrets always and value-like keys until values are shown", () => {
  const context = {
    value: { token: "abc", nested: { password: "x" } },
    outcome: "value",
  };

  const hidden = describeContext(event("hydrate landed", context), false);
  expect(hidden.context).toContain("[Values are hidden]");
  expect(hidden.context).not.toContain("abc");

  const shown = describeContext(event("hydrate landed", context), true);
  expect(shown.context).toContain("[Redacted]");
  expect(shown.context).not.toContain("abc");
  expect(shown.context).toContain("nested");
});

test("bounds depth, breadth and repeated references without running getters", () => {
  let ran = false;
  const deep = Array.from({ length: 10 }).reduce<unknown>(
    (next) => ({ next }),
    {},
  );
  const wide = Object.fromEntries(
    Array.from({ length: 60 }, (_, index) => [`key${index}`, index]),
  );
  const context = {
    deep,
    wide,
    twice: [wide, wide],
    get trap() {
      ran = true;
      return "boom";
    },
  };

  const { context: text, kind } = describeContext(
    event("outside applied", context),
    true,
  );
  expect(ran).toBe(false);
  expect(text).toContain("[Accessor]");
  expect(text).toContain("[Truncated]");
  expect(text).toContain("[Circular or repeated reference]");
  expect(kind).toBe("OUTSIDE");
});

test("an invalid hydrate is an error, a failed migration too", () => {
  expect(
    describeContext(
      event("hydrate landed", { outcome: "invalid", cause: new Error("bad") }),
      false,
    ),
  ).toMatchObject({ kind: "ERROR", summary: "invalid · bad" });
  expect(
    describeContext(
      event("migration failed", { cause: "boom" }, "migration"),
      false,
    ).kind,
  ).toBe("ERROR");
  expect(
    describeContext(event("migration step", { version: 2 }, "migration"), false)
      .kind,
  ).toBe("MIGRATION");
  expect(
    describeContext(event("write durable", { generation: 1 }), false).kind,
  ).toBe("WRITE");
  expect(
    describeContext(event("hydrate landed", { outcome: "value" }), false).kind,
  ).toBe("READ");
  expect(
    describeContext(event("store disposed", null, "store"), false).kind,
  ).toBe("STORE");
});

test("adapter observation failures appear in the error filter", () => {
  expect(
    describeContext(
      event("observation failed", { cause: new Error("offline") }, "store"),
      false,
    ),
  ).toMatchObject({ kind: "ERROR", summary: "offline" });
});
