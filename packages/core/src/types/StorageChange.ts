/**
 * One change an adapter observed from outside this store. `{ key: null }` means
 * everything changed and the core must re-read.
 *
 * The key is the physical key the core composed, and `value` is already decoded
 * by the adapter, absent values reported as `undefined`.
 *
 * @example
 * ```ts
 * adapter.observe?.((change) => (change.key === null ? reload() : apply(change.key, change.value)));
 * ```
 */
export type StorageChange = { key: string; value: unknown } | { key: null };
