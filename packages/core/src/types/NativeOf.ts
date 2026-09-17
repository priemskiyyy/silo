import type { Storages } from "src/types/Storages";

/**
 * The native handles a store's storages carry, by name: for each storage the
 * union of every candidate's own, because which one is chosen is decided at
 * construction.
 *
 * @example
 * ```ts
 * type Native = NativeOf<typeof storages>; // { default: Storage | null | MemoryStore; secure: IndexedDbHandle | MemoryStore }
 * ```
 */
export type NativeOf<TStorages extends Storages> = {
  [TName in keyof TStorages]: TStorages[TName]["adapters"][number]["native"];
};
