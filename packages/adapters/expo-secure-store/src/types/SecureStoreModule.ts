import type { SecureStoreOptions } from "src/types/SecureStoreOptions";

/**
 * Expo SecureStore methods used by the adapter.
 *
 * @example
 * ```ts
 * import * as SecureStore from "expo-secure-store";
 *
 * const store: SecureStoreModule = SecureStore;
 * ```
 */
export type SecureStoreModule = {
  getItemAsync(
    key: string,
    options?: SecureStoreOptions,
  ): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: SecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
};
