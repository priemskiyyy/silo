/**
 * Translation between an application value and the raw value an adapter stores.
 *
 * `encode` runs on every write and `decode` once per inbound raw value, never on
 * read. Both may throw: `encode` reaches the caller of `set`, `decode` is
 * contained by the core and reported as a value status.
 *
 * @example
 * ```ts
 * const dates = { encode: (value: Date) => value.toISOString(), decode: (raw) => new Date(String(raw)) };
 * ```
 */
export type Codec<TValue> = {
  // Bivariant methods let ValueDefinition<unknown> constrain heterogeneous schemas.
  encode(value: TValue): unknown;
  decode(raw: unknown): TValue;
};
