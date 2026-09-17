import type { StorageAdapterShape } from "src/types/StorageAdapterShape";

/**
 * A backend whose reads and writes complete in the calling frame, such as
 * `localStorage`.
 *
 * The core composes physical keys and the adapter must not transform them. The
 * adapter owns serialization: it receives and returns decoded values, and `get`
 * returns `undefined` for an absent key. `set` and `remove` may throw and the
 * core contains it. `available` is a cheap, synchronous probe of the platform,
 * which is what lets a store given a list of adapters choose one before
 * anything is read. `dispose` is required, synchronous and idempotent, and
 * silences `observe`. `native` is identity stable for the adapter's life.
 *
 * `observe` and `keys` are the optional members. `keys` lists every physical
 * key the backend holds, which is what lets a migration reach scoped data.
 *
 * @example
 * ```ts
 * const memory = { mode: "sync", name: "memory", native: store, get, set, remove, available, dispose } satisfies SyncStorageAdapter<Map<string, unknown>>;
 * ```
 */
export type SyncStorageAdapter<TNative = unknown> = StorageAdapterShape<
  "sync",
  TNative,
  unknown,
  void,
  string[]
>;
