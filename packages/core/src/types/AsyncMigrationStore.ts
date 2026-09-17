import type { SyncMigrationStore } from "src/types/SyncMigrationStore";

type Operations = Omit<SyncMigrationStore, "storage">;

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
  [TKey in keyof Operations]: (
    ...args: Parameters<Operations[TKey]>
  ) => Promise<ReturnType<Operations[TKey]>>;
} & { storage: (name: string) => AsyncMigrationStore };
