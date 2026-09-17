import { createStorageAdapter } from "@priemskiyyy/silo";
import type { UnstorageAdapterOptions } from "src/types/UnstorageAdapterOptions";

// Percent encoding prevents unstorage from rewriting slashes, queries and colons.
const encodeKey = (key: string) => encodeURIComponent(key);

// Foreign keys may not be URI encoded.
const decodeKey = (key: string) => {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
};

/**
 * Wraps an unstorage instance, preserving physical keys and JSON value types.
 *
 * @example
 * ```ts
 * const adapter = unstorage({ storage: createStorage({ driver: fsDriver({ base: "./data" }) }) });
 * ```
 */
export const unstorage = ({
  storage,
  available = () => true,
}: UnstorageAdapterOptions) =>
  createStorageAdapter({
    mode: "async",
    name: "unstorage",
    native: storage,
    get: async (key) => {
      const stored = await storage.getItem(encodeKey(key));

      if (stored !== null) {
        return stored;
      }

      return (await storage.hasItem(encodeKey(key))) ? null : undefined;
    },
    set: async (key, value) => {
      const text = JSON.stringify(value);

      if (text === undefined) {
        await storage.removeItem(encodeKey(key));
        return;
      }

      await storage.setItem(encodeKey(key), text);
    },
    remove: (key) => storage.removeItem(encodeKey(key)),
    keys: async () => (await storage.getKeys()).map(decodeKey),
    available,
    dispose: () => {},
  });
