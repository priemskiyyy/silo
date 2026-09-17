import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { LocalStorageAdapterOptions } from "src/types/LocalStorageAdapterOptions";

// Use Storage.key(); object properties are not the storage key list.
const listKeys = (storage: Storage) => {
  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key === null) {
      continue;
    }

    keys.push(key);
  }

  return keys;
};

/**
 * Stores JSON text in localStorage and observes writes from other tabs.
 * Resolves the platform lazily; native is null when storage is unavailable.
 *
 * @example
 * ```ts
 * const adapter = localStorage();
 * ```
 */
export const localStorage = ({
  available,
  format,
}: LocalStorageAdapterOptions = {}) => {
  let storage: Storage | null | undefined;
  const stops = new Set<() => void>();

  const native = () => {
    if (storage !== undefined) {
      return storage;
    }

    try {
      // Reading the storage getter can throw when site data is blocked.
      storage = globalThis.localStorage ?? null;
    } catch {
      storage = null;
    }

    return storage;
  };

  const writable = (operation: string, key: string) => {
    const platform = native();

    if (platform === null) {
      throw new Error(
        `Cannot ${operation} "${key}" through the local-storage adapter: this environment has no localStorage, so nothing was persisted.`,
      );
    }

    return platform;
  };

  return createTextStorageAdapter<Storage | null>({
    mode: "sync",
    name: "local-storage",
    get native() {
      return native();
    },
    format,
    read: (key) => native()?.getItem(key),
    write: (key, text) => writable("write", key).setItem(key, text),
    remove: (key) => writable("remove", key).removeItem(key),
    available: available ?? (() => native() !== null),
    keys: () => {
      const platform = native();

      return platform === null ? [] : listKeys(platform);
    },
    dispose: () => {
      for (const stop of stops) {
        stop();
      }
    },
    observe: (listener) => {
      const platform = native();

      if (platform === null) {
        return () => {};
      }

      const handleStorageEvent = (event: StorageEvent) => {
        if (event.storageArea !== platform) {
          return;
        }

        if (event.key === null) {
          listener({ key: null });
          return;
        }

        listener({ key: event.key, text: event.newValue });
      };

      const stop = () => {
        if (!stops.delete(stop)) {
          return;
        }

        globalThis.removeEventListener("storage", handleStorageEvent);
      };

      globalThis.addEventListener("storage", handleStorageEvent);
      stops.add(stop);

      return stop;
    },
  });
};
