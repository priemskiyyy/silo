import type { AsyncMigration } from "src/types/AsyncMigration";
import type { Storages } from "src/types/Storages";
import type { SyncMigration } from "src/types/SyncMigration";

/**
 * What a store is constructed with.
 *
 * `storages` names the backends, each with its schema and an ordered list of
 * candidate adapters. The first candidate whose `available()` probe passes is
 * chosen when the store is constructed and kept for its life, the last is
 * taken regardless, and the rest are disposed. The storages decide which
 * migration flavour `migrations` takes: all synchronous candidates make
 * synchronous migrations, one asynchronous candidate anywhere makes them
 * asynchronous. End every list with `memory()` to always land on a backend
 * that works.
 *
 * `namespace` defaults to `"silo"` and `""` is the deliberate opt-in to a shared
 * keyspace; a storage's own `namespace` overrides it for the keys that live
 * there. `migrations` are keyed by the version each one produces, and the
 * highest key is the version the store runs at. `now` is the clock expiry is
 * measured against, so tests never touch real timers.
 *
 * @example
 * ```ts
 * const options = { storages, migrations } satisfies SiloOptions<typeof storages>;
 * ```
 */
export type SiloOptions<TStorages extends Storages> = {
  storages: TStorages;
  namespace?: string;
  migrations?: "async" extends TStorages[keyof TStorages]["adapters"][number]["mode"]
    ? Record<number, AsyncMigration>
    : Record<number, SyncMigration>;
  now?: () => number;
};
