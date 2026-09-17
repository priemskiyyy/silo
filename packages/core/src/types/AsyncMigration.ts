import type { AsyncMigrationStore } from "src/types/AsyncMigrationStore";

/**
 * One step to the version it is keyed by, on storages of which at least one
 * is asynchronous.
 *
 * Steps run as a promise chain in ascending order while `silo.status` reports
 * `migrating` and every value's hydration waits. Each version is recorded as
 * its step lands, so a failure leaves the record at the last step that did
 * and the next start resumes from there.
 *
 * @example
 * ```ts
 * const migrations = { 2: async (store) => await store.remove("legacyToken") } satisfies Record<number, AsyncMigration>;
 * ```
 */
export type AsyncMigration = (
  store: AsyncMigrationStore,
) => void | Promise<void>;
