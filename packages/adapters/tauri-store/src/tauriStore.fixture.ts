import type { TauriStore } from "src/types/TauriStore";

/**
 * A Tauri store for tests: a Map behind the promise API, values passed
 * through JSON the way the IPC does, and `onChange` fired for every write
 * and deletion, own writes included, the way the plugin does it.
 */
export const fakeTauriStore = () => {
  const entries = new Map<string, unknown>();
  const listeners = new Set<(key: string, value: unknown) => void>();
  const announce = (key: string, value: unknown) => {
    for (const listener of [...listeners]) {
      listener(key, value);
    }
  };
  const store: TauriStore = {
    get: async (key) => entries.get(key),
    set: async (key, value) => {
      const stored: unknown = JSON.parse(JSON.stringify(value));

      entries.set(key, stored);
      announce(key, stored);
    },
    delete: async (key) => {
      const existed = entries.delete(key);

      announce(key, undefined);

      return existed;
    },
    keys: async () => [...entries.keys()],
    onChange: async (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return { store, entries, listeners };
};
