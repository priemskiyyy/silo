import type { ValueDefinition } from "src/types/ValueDefinition";
import { assertUnreachable } from "src/utils/common/assertUnreachable";

type Envelope = { value: unknown; expires: { at: number } };

type Inbound =
  | { kind: "absent" }
  | { kind: "expired" }
  | { kind: "value"; value: unknown }
  | { kind: "invalid"; error: unknown };

/** Owns the stored representation: codec conversion and expiry envelopes. */
export class ValueCodec {
  #options;

  constructor(options: {
    definition: ValueDefinition<unknown>;
    now: () => number;
  }) {
    this.#options = options;
  }

  get fallback() {
    return this.#options.definition.fallback;
  }

  encode(value: unknown) {
    const { definition, now } = this.#options;
    const raw = definition.encode(value);
    const { expires } = definition;
    if (expires === undefined) {
      return raw;
    }
    if (expires.in !== undefined) {
      return {
        value: raw,
        expires: { at: now() + expires.in },
      } satisfies Envelope;
    }
    if (expires.at !== undefined) {
      return { value: raw, expires: { at: expires.at } } satisfies Envelope;
    }
    return assertUnreachable(expires);
  }

  decode(raw: unknown): Inbound {
    if (raw === undefined) {
      return { kind: "absent" };
    }
    const { definition, now } = this.#options;

    try {
      // Bare values predate expiry support and remain readable without a deadline.
      if (definition.expires !== undefined && isEnvelope(raw)) {
        if (raw.expires.at <= now()) {
          return { kind: "expired" };
        }
        raw = raw.value;
      }

      return { kind: "value", value: definition.decode(raw) };
    } catch (error) {
      return { kind: "invalid", error };
    }
  }
}

const isEnvelope = (raw: unknown): raw is Envelope => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }

  if (!("value" in raw) || !("expires" in raw)) {
    return false;
  }

  const { expires } = raw;

  if (typeof expires !== "object" || expires === null) {
    return false;
  }

  return "at" in expires && typeof expires.at === "number";
};
