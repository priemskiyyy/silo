import type { ValueDefinition } from "src/types/ValueDefinition";

/**
 * The constraint every schema literal satisfies: a flat map of key to definition.
 *
 * `ValueDefinition<unknown>` is a supertype of every definition, so a literal
 * keeps each entry's own value type while still matching the constraint.
 *
 * @example
 * ```ts
 * const schema = { theme: value<Theme>({ fallback: "light" }) } satisfies SiloSchema;
 * ```
 */
export type SiloSchema = Record<string, ValueDefinition<unknown>>;
