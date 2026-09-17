/**
 * How a text backend's values become text and back. `JSON` is the default and
 * the shape, so `superjson` and `devalue` drop in as they are. `stringify`
 * may answer `undefined`, which the adapter treats as a removal, the way
 * `JSON.stringify(undefined)` does.
 *
 * @example
 * ```ts
 * const adapter = localStorage({ format: superjson });
 * ```
 */
export type TextFormat = {
  stringify(value: unknown): string | undefined;
  parse(text: string): unknown;
};
