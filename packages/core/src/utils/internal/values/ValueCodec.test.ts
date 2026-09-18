import { expect, test } from "vitest";
import { ValueCodec } from "src/utils/internal/values/ValueCodec";
import { value } from "src/utils/value";

const strings = value({
  codec: {
    encode: (text: string) => text,
    decode: (raw: unknown) => {
      if (typeof raw !== "string") {
        throw new Error(`expected a string, received ${typeof raw}`);
      }

      return raw;
    },
  },
});
const expiring = value({ expires: { in: 1_000 } });
const now = () => 5_000;

test("undefined is absent, and anything else decodes once", () => {
  const codec = new ValueCodec({ definition: strings, now });
  expect(codec.decode(undefined)).toEqual({
    kind: "absent",
  });
  expect(codec.decode("dark")).toEqual({
    kind: "value",
    value: "dark",
  });
  expect(codec.decode(42)).toEqual({
    kind: "invalid",
    error: expect.any(Error),
  });
});

test.each([expiring, value({ expires: { at: 5_000 } })])(
  "only a key declaring expires reads an envelope, live or expired (%j)",
  (definition) => {
    const live = { value: "secret", expires: { at: 5_001 } };
    const stale = { value: "secret", expires: { at: 5_000 } };
    const codec = new ValueCodec({ definition, now });

    expect(codec.decode(live)).toEqual({
      kind: "value",
      value: "secret",
    });
    expect(codec.decode(stale)).toEqual({
      kind: "expired",
    });
    expect(new ValueCodec({ definition: value(), now }).decode(live)).toEqual({
      kind: "value",
      value: live,
    });
  },
);

test("a raw that is not an envelope on an expiring key is a bare, never expiring value", () => {
  const codec = new ValueCodec({ definition: expiring, now });
  expect(codec.decode("written before expiry")).toEqual({
    kind: "value",
    value: "written before expiry",
  });
  expect(codec.decode({ value: "x" })).toEqual({
    kind: "value",
    value: { value: "x" },
  });
});

test.each(["expires", "at", "value", "has"])(
  "a throwing envelope %s is an invalid value",
  (property) => {
    const failure = new Error("Cannot read envelope");
    const raw = { value: "stored", expires: { at: 6_000 } };
    const codec = new ValueCodec({ definition: expiring, now });
    if (property === "has") {
      const proxy = new Proxy(raw, {
        has: () => {
          throw failure;
        },
      });
      expect(codec.decode(proxy)).toEqual({ kind: "invalid", error: failure });
      return;
    }
    Object.defineProperty(property === "at" ? raw.expires : raw, property, {
      get: () => {
        throw failure;
      },
    });

    expect(codec.decode(raw)).toEqual({ kind: "invalid", error: failure });
  },
);
