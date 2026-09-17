import type { StorageAdapterShape } from "src/types/StorageAdapterShape";

/**
 * A backend whose reads and writes settle later, such as IndexedDB.
 *
 * Identical to `SyncStorageAdapter` except that `get`, `set`, `remove` and
 * `keys` return promises. A rejected `set` or `remove` is contained by the
 * core.
 *
 * @example
 * ```ts
 * const indexeddb = { mode: "async", name: "indexeddb", native: handle, get, set, remove, available, dispose } satisfies AsyncStorageAdapter<Handle>;
 * ```
 */
export type AsyncStorageAdapter<TNative = unknown> = StorageAdapterShape<
  "async",
  TNative,
  Promise<unknown>,
  Promise<void>,
  Promise<string[]>
>;
