import type { DurableStorage } from "src/types/DurableStorage";

/**
 * Options for `cloudflareDurableObjectStorage()`.
 *
 * @example
 * ```ts
 * const adapter = cloudflareDurableObjectStorage({ storage: this.ctx.storage });
 * ```
 */
export type CloudflareDurableObjectStorageAdapterOptions = {
  storage: DurableStorage;
  available?: () => boolean;
};
