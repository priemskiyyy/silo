import type { SyncMigrationStore } from "src/types/SyncMigrationStore";

/**
 * One step to the version it is keyed by, on synchronous storages.
 *
 * It runs inside the constructor, in ascending order with every other missing
 * step, and its version is recorded as soon as it lands, so a later step that
 * fails never makes it run again. Callbacks must complete synchronously. TypeScript allows promises in
 * void-returning callbacks, so the runtime rejects thenables before recording
 * the step as complete.
 *
 * @example
 * ```ts
 * const migrations = { 2: (store) => store.remove("legacyToken") } satisfies Record<number, SyncMigration>;
 * ```
 */
export type SyncMigration = (store: SyncMigrationStore) => void;
