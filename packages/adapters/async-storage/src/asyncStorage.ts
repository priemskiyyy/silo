import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { AsyncStorageAdapterOptions } from "src/types/AsyncStorageAdapterOptions";

const alwaysAvailable = () => true;

/**
 * Stores JSON text through React Native AsyncStorage.
 *
 * @example
 * ```ts
 * const adapter = asyncStorage({ storage: AsyncStorage });
 * ```
 */
export const asyncStorage = ({
  storage,
  available = alwaysAvailable,
  format,
}: AsyncStorageAdapterOptions) =>
  createTextStorageAdapter({
    mode: "async",
    name: "async-storage",
    native: storage,
    format,
    read: (key) => storage.getItem(key),
    write: (key, text) => storage.setItem(key, text),
    remove: (key) => storage.removeItem(key),
    keys: async () => [...(await storage.getAllKeys())],
    available,
    dispose: () => {},
  });
