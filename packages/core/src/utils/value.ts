import type { Codec } from "src/types/Codec";
import type { Expiration } from "src/types/Expiration";
import type { StandardSchema } from "src/types/StandardSchema";
import type { ValueDefinition } from "src/types/ValueDefinition";

type ValueOptions<TValue> = {
  expires?: Expiration;
} & (
  | { codec: Codec<TValue>; schema?: never }
  | { schema: StandardSchema<TValue>; codec?: never }
  | { codec?: never; schema?: never }
);

/**
 * Declares a stored value, optionally translated by a codec or validated by a
 * Standard Schema. Without either, stored data is trusted. A fallback makes
 * the read type `TValue`; otherwise it is `TValue | undefined`.
 *
 * @example
 * ```ts
 * const Schema = {
 *   theme: value({ schema: ThemeSchema, fallback: "light" }),
 *   user: value({ schema: UserSchema, expires: { in: 3_600_000 } }),
 *   seenAt: value({ codec: dateCodec }),
 * } satisfies SiloSchema;
 * ```
 */
// With a schema or codec, the fallback checks its type instead of widening it.
export function value<TValue>(
  options: { expires?: Expiration; fallback: NoInfer<TValue> } & (
    | { schema: StandardSchema<TValue>; codec?: never }
    | { codec: Codec<TValue>; schema?: never }
  ),
): ValueDefinition<TValue, TValue>;
export function value<TValue>(options: {
  fallback: TValue;
  expires?: Expiration;
  codec?: never;
  schema?: never;
}): ValueDefinition<TValue, TValue>;
export function value<TValue>(
  options?: ValueOptions<TValue> & { fallback?: never },
): ValueDefinition<TValue, undefined>;
export function value(
  options: ValueOptions<unknown> & { fallback?: unknown } = {},
): ValueDefinition<unknown> {
  const { codec, schema: Schema } = options;

  return {
    fallback: options.fallback,
    expires: options.expires,
    encode: (value) => {
      if (codec !== undefined) {
        return codec.encode(value);
      }
      return value;
    },
    decode: (raw) => {
      if (codec !== undefined) {
        return codec.decode(raw);
      }
      if (Schema === undefined) {
        return raw;
      }
      const result = Schema["~standard"].validate(raw);
      if ("then" in result) {
        // Reject async validation without leaving its promise unhandled.
        Promise.resolve(result).catch(() => {});
        throw new Error(
          `Silo cannot decode with an asynchronous schema: ${Schema["~standard"].vendor} returned a promise from validate.`,
        );
      }
      if (result.issues !== undefined) {
        throw new Error(
          `Silo could not decode a stored value with the ${Schema["~standard"].vendor} schema: ${result.issues.map((issue) => issue.message).join("; ")}`,
        );
      }
      return result.value;
    },
  };
}
