import type { MmkvStorage } from "src/types/MmkvStorage";

/**
 * An in-process stand-in for an `MMKV` instance, for the tests: strings in a
 * `Map`, and listeners notified on every write and delete, the way the real
 * instance notifies for the application's own writes too.
 */
export const createFakeMmkv = () => {
  const store = new Map<string, string>();
  const listeners = new Set<(key: string) => void>();
  const notify = (key: string) => {
    for (const listener of [...listeners]) {
      listener(key);
    }
  };
  const storage: MmkvStorage = {
    getString: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
      notify(key);
    },
    delete: (key) => {
      store.delete(key);
      notify(key);
    },
    getAllKeys: () => [...store.keys()],
    addOnValueChangedListener: (listener) => {
      listeners.add(listener);

      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };

  return { store, storage, listeners };
};
