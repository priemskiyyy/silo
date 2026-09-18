import type { SyncMigrationStore } from "src/types/SyncMigrationStore";

/**
 * Namespace-relative migration operations, all asynchronous when any storage is async.
 * `storage(name)` selects another storage synchronously; its operations still return promises.
 *
 * @example
 * ```ts
 * const migrate: AsyncMigration = async (store) => {
 *   await store.rename("legacyTheme", "theme");
 *   await store.move("token", { to: "secure" });
 * };
 * ```
 */
export type AsyncMigrationStore = {
  [TKey in Exclude<keyof SyncMigrationStore, "storage">]: (
    ...args: Parameters<SyncMigrationStore[TKey]>
  ) => Promise<ReturnType<SyncMigrationStore[TKey]>>;
} & { storage: (name: string) => AsyncMigrationStore };
