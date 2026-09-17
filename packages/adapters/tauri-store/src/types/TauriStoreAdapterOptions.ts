import type { TauriStore } from "src/types/TauriStore";

/**
 * Options for `tauriStore()`.
 *
 * @example
 * ```ts
 * const adapter = tauriStore({ store: await Store.load("state.json") });
 * ```
 */
export type TauriStoreAdapterOptions = {
  store: TauriStore;
  available?: () => boolean;
};
