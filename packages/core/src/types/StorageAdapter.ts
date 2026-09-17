import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";

/**
 * Either adapter variant. `mode` is the discriminant the core dispatches on, and
 * the two are not interchangeable: a sync adapter is rejected where an async one
 * is expected.
 *
 * @example
 * ```ts
 * const adapters: Array<StorageAdapter> = [memory(), localStorage()];
 * ```
 */
export type StorageAdapter<TNative = unknown> =
  SyncStorageAdapter<TNative> | AsyncStorageAdapter<TNative>;
