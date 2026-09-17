import type { ElectronStore } from "src/types/ElectronStore";

/**
 * Options for `electronStore()`.
 *
 * @example
 * ```ts
 * const adapter = electronStore({ store: new Store() });
 * ```
 */
export type ElectronStoreAdapterOptions = {
  store: ElectronStore;
  available?: () => boolean;
};
