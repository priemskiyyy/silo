import { expect, test } from "vitest";
import type { StandardSchema } from "src/types/StandardSchema";
import { value } from "src/utils/value";

// A hand-rolled Standard Schema, so the test does not depend on a validator
// library while proving the contract is the one Zod, Valibot and ArkType ship.
const StringSchema: StandardSchema<string> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (raw) =>
      typeof raw === "string"
        ? { value: raw }
        : {
            issues: [{ message: `expected a string, received ${typeof raw}` }],
          },
  },
};

test("a declared fallback is reported without being encoded", () => {
  const theme = value<"light" | "dark">({ fallback: "light" });

  expect(theme.fallback).toBe("light");
  expect(theme.expires).toBeUndefined();
});

test("an undeclared fallback reads as undefined", () => {
  const user = value<{ name: string }>();

  expect(user.fallback).toBeUndefined();
});

test("without a codec or a schema both directions are identity and keep the reference", () => {
  const user = value<{ name: string }>();
  const stored = { name: "ada" };

  expect(user.encode(stored)).toBe(stored);
  expect(user.decode(stored)).toBe(stored);
});

test("a codec is used in both directions and relative expiry is carried", () => {
  const stamps = value({
    codec: {
      encode: (date: Date) => date.toISOString(),
      decode: (raw: unknown) => new Date(String(raw)),
    },
    expires: { in: 1000 },
  });

  expect(stamps.expires).toEqual({ in: 1000 });
  expect(stamps.encode(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
  expect(stamps.decode("1970-01-01T00:00:00.000Z")).toEqual(new Date(0));
});

test("an absolute expiry is carried unchanged", () => {
  const token = value<string>({ expires: { at: 5_000 } });

  expect(token.expires).toEqual({ at: 5_000 });
});

test("a throwing codec throws through the definition", () => {
  const strict = value({
    codec: {
      encode: (text: string) => text,
      decode: (): string => {
        throw new Error("invalid");
      },
    },
  });

  expect(() => strict.decode("x")).toThrow("invalid");
});

test("a schema validates on decode, passes encode through, and names its issues", () => {
  const name = value({ schema: StringSchema, fallback: "anonymous" });

  expect(name.fallback).toBe("anonymous");
  expect(name.encode("ada")).toBe("ada");
  expect(name.decode("ada")).toBe("ada");
  expect(() => name.decode(42)).toThrow(
    "Silo could not decode a stored value with the test schema: expected a string, received number",
  );
});

test("an asynchronous schema is refused rather than making decode awaitable", () => {
  const lazy: StandardSchema<string> = {
    "~standard": {
      version: 1,
      vendor: "slow",
      validate: (raw) => Promise.resolve({ value: String(raw) }),
    },
  };

  expect(() => value({ schema: lazy }).decode("x")).toThrow(
    "Silo cannot decode with an asynchronous schema: slow returned a promise from validate.",
  );
});

test("a rejected asynchronous schema is contained after decoding refuses it", async () => {
  const Schema: StandardSchema<string> = {
    "~standard": {
      version: 1,
      vendor: "rejected",
      validate: () => Promise.reject(new Error("validation failed")),
    },
  };

  expect(() => value({ schema: Schema }).decode("x")).toThrow(
    "Silo cannot decode with an asynchronous schema",
  );
  await new Promise((resolve) => setImmediate(resolve));
});
