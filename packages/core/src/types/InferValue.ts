import type { ValueDefinition } from "src/types/ValueDefinition";

/**
 * The type a definition reads as: `TValue` with a fallback, `TValue | undefined`
 * without one.
 *
 * @example
 * ```ts
 * type Value = InferValue<typeof schema.theme>;
 * ```
 */
export type InferValue<TDefinition> =
  TDefinition extends ValueDefinition<unknown>
    ? ReturnType<TDefinition["decode"]> | TDefinition["fallback"]
    : never;
