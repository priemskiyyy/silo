/**
 * One change an adapter observed from outside this store. `{ key: null }` means
 * everything changed and the core must re-read.
 *
 * The key is the physical key the core composed, and `value` is already decoded
 * by the adapter, absent values reported as `undefined`. An `error` reports a
 * failed external read or decode; a null key applies to the whole storage.
 *
 * @example
 * ```ts
 * adapter.observe?.((change) => console.log(change));
 * ```
 */
export type StorageChange =
  | { key: string; value: unknown }
  | { key: null }
  | { key: string | null; error: { cause: unknown } };
