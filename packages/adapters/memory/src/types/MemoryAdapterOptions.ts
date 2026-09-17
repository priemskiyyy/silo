/**
 * Options for `memory()`.
 *
 * @example
 * ```ts
 * const adapter = memory({ available: () => process.env.NODE_ENV === "test" });
 * ```
 */
export type MemoryAdapterOptions = {
  available?: () => boolean;
};
