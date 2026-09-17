import { createStorageAdapter } from "@priemskiyyy/silo";
import { encodeKey } from "src/encodeKey";
import type { ElectronStoreAdapterOptions } from "src/types/ElectronStoreAdapterOptions";

// Foreign keys may not be URI encoded.
const decodeKey = (key: string) => {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
};

const own = (record: Record<string, unknown>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * Wraps an electron-store or conf instance and observes changes to its file.
 *
 * @example
 * ```ts
 * const adapter = electronStore({ store: new Store() });
 * ```
 */
export const electronStore = ({
  store,
  available = () => true,
}: ElectronStoreAdapterOptions) => {
  const stops = new Set<() => void>();

  return createStorageAdapter({
    mode: "sync",
    name: "electron-store",
    native: store,
    get: (key) => {
      const encoded = encodeKey(key);

      return store.has(encoded) ? store.get(encoded) : undefined;
    },
    set: (key, value) => {
      if (value === undefined) {
        store.delete(encodeKey(key));
        return;
      }

      store.set(encodeKey(key), value);
    },
    remove: (key) => store.delete(encodeKey(key)),
    keys: () => Object.keys(store.store).map(decodeKey),
    available,
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }
    },
    observe: (listener) => {
      // Fresh objects from disk require comparing serialized values, not references.
      const handleChange = (
        next: Record<string, unknown> = {},
        previous: Record<string, unknown> = {},
      ) => {
        for (const key of new Set([
          ...Object.keys(next),
          ...Object.keys(previous),
        ])) {
          const value = own(next, key);

          if (JSON.stringify(value) === JSON.stringify(own(previous, key))) {
            continue;
          }

          listener({ key: decodeKey(key), value });
        }
      };
      const unsubscribe = store.onDidAnyChange(handleChange);
      const stop = () => {
        if (!stops.delete(stop)) {
          return;
        }

        unsubscribe();
      };

      stops.add(stop);

      return stop;
    },
  });
};
