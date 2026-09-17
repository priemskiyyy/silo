import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";

/**
 * Raw access to one namespace during a migration on synchronous storages, so a
 * migration can reach keys the current schema no longer declares: the
 * adapter's own operations, with `keys` required, on the default storage,
 * `storage(name)` for the same access to any other, and `copy`, `move` and
 * `rename` for the steps almost every migration is made of.
 *
 * Keys are namespace relative: the store composes the physical key, and `keys`
 * lists what the namespace holds with the prefix already stripped. Values pass
 * through undecoded, exactly as the adapter holds them. `keys` throws on an
 * adapter that cannot enumerate, and `storage` throws on a name the store does
 * not declare.
 *
 * @example
 * ```ts
 * const migrate: SyncMigration = (store) => {
 *   store.rename("legacyTheme", "theme");
 *   store.move("token", { to: "secure" });
 * };
 * ```
 */
export type SyncMigrationStore = Required<
  Pick<SyncStorageAdapter, "get" | "set" | "remove" | "keys">
> & {
  storage: (name: string) => SyncMigrationStore;
  /** Copies a key into a storage and under a name, defaulting to this storage and the same key. An absent key copies nothing. */
  copy: (key: string, target?: { to?: string; as?: string }) => void;
  /** `copy`, then removes the source, unless the target is the source itself. */
  move: SyncMigrationStore["copy"];
  /** `move` within this storage, so the source key becomes `to`. */
  rename: (from: string, to: string) => void;
};
