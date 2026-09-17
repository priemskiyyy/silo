/**
 * The Map exposed by a memory adapter as native. Values are cloned on adapter reads and writes.
 *
 * @example
 * ```ts
 * const adapter = memory();
 * adapter.native.set("silo:theme", "dark");
 * ```
 */
export type MemoryStore = Map<string, unknown>;
