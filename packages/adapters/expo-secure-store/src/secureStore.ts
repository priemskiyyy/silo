import { createTextStorageAdapter } from "@priemskiyyy/silo";
import { encodeKey } from "src/encodeKey";
import type { SecureStoreAdapterOptions } from "src/types/SecureStoreAdapterOptions";

const alwaysAvailable = () => true;

/**
 * Stores JSON text in Expo SecureStore with encoded keys and per-call options.
 *
 * @example
 * ```ts
 * const adapter = secureStore({ store: SecureStore, options: { requireAuthentication: true } });
 * ```
 */
export const secureStore = ({
  store,
  options,
  available = alwaysAvailable,
  format,
}: SecureStoreAdapterOptions) =>
  createTextStorageAdapter({
    mode: "async",
    name: "expo-secure-store",
    native: store,
    format,
    read: (key) => store.getItemAsync(encodeKey(key), options),
    write: (key, text) => store.setItemAsync(encodeKey(key), text, options),
    remove: (key) => store.deleteItemAsync(encodeKey(key), options),
    available,
    dispose: () => {},
  });
