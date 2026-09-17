import type { TextStorageMappingShape } from "src/types/TextStorageMappingShape";

/**
 * A text backend that answers in the calling frame, such as `localStorage` or
 * MMKV. `read` answers the stored text, or `null` or `undefined` for an
 * absent key, whichever the platform says.
 *
 * @example
 * ```ts
 * const mapping = { mode: "sync", name: "mmkv", native: storage, read: (key) => storage.getString(key), write: (key, text) => storage.set(key, text), remove: (key) => storage.delete(key), available: () => true, dispose: () => {} } satisfies SyncTextStorageMapping<MMKV>;
 * ```
 */
export type SyncTextStorageMapping<TNative = unknown> = TextStorageMappingShape<
  "sync",
  TNative,
  string | null | undefined,
  void,
  string[]
>;
