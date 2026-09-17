import type { SiloOptions } from "src/types/SiloOptions";
import type { Storages } from "src/types/Storages";

/**
 * The migration flavour a store's storages take: synchronous when every
 * candidate of every storage is, asynchronous as soon as one is, because a
 * migration reaches every storage and the slowest decides.
 *
 * @example
 * ```ts
 * type Step = MigrationFor<typeof storages>; // AsyncMigration
 * ```
 */
export type MigrationFor<TStorages extends Storages> = NonNullable<
  SiloOptions<TStorages>["migrations"]
>[number];
