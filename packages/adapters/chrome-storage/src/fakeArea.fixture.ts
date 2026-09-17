import type { ChromeStorageArea } from "src/types/ChromeStorageArea";

type Listener = Parameters<ChromeStorageArea["onChanged"]["addListener"]>[0];

/**
 * A `chrome.storage` area for tests: a Map behind the promise API, and
 * `onChanged` fired on a later task for every write, own writes included,
 * the way Chrome does it.
 */
export const fakeArea = () => {
  const store = new Map<string, unknown>();
  const listeners = new Set<Listener>();
  const announce = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  ) => {
    setTimeout(() => {
      for (const listener of [...listeners]) {
        listener(changes);
      }
    }, 0);
  };
  const entries = (keys: string | string[] | null) => {
    if (keys === null) {
      return [...store.entries()];
    }

    const asked = typeof keys === "string" ? [keys] : keys;

    return asked.flatMap((key) =>
      store.has(key) ? [[key, store.get(key)] satisfies [string, unknown]] : [],
    );
  };
  const area: ChromeStorageArea = {
    get: async (keys) => Object.fromEntries(entries(keys)),
    set: async (items) => {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};

      for (const [key, value] of Object.entries(items)) {
        Object.defineProperty(changes, key, {
          value: { oldValue: store.get(key), newValue: value },
          enumerable: true,
        });
        store.set(key, value);
      }

      announce(changes);
    },
    remove: async (keys) => {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};

      for (const key of typeof keys === "string" ? [keys] : keys) {
        if (!store.has(key)) {
          continue;
        }

        Object.defineProperty(changes, key, {
          value: { oldValue: store.get(key) },
          enumerable: true,
        });
        store.delete(key);
      }

      announce(changes);
    },
    onChanged: {
      addListener: (listener) => {
        listeners.add(listener);
      },
      removeListener: (listener) => {
        listeners.delete(listener);
      },
    },
  };

  return { area, store, listeners };
};
