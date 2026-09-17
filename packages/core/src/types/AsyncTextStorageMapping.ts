import type { TextStorageMappingShape } from "src/types/TextStorageMappingShape";

/**
 * A text backend that answers later, such as AsyncStorage or Redis.
 * Identical to `SyncTextStorageMapping` except that `read`, `write`, `remove`
 * and `keys` return promises.
 *
 * @example
 * ```ts
 * const mapping = { mode: "async", name: "redis", native: client, read: (key) => client.get(key), write: async (key, text) => { await client.set(key, text); }, remove: async (key) => { await client.del(key); }, available: () => true, dispose: () => {} } satisfies AsyncTextStorageMapping<Redis>;
 * ```
 */
export type AsyncTextStorageMapping<TNative = unknown> =
  TextStorageMappingShape<
    "async",
    TNative,
    Promise<string | null | undefined>,
    Promise<void>,
    Promise<string[]>
  >;
