import type { ElectronStore } from "src/types/ElectronStore";

type Listener = Parameters<ElectronStore["onDidAnyChange"]>[0];

/**
 * An in-process stand-in for an `electron-store` instance, for the tests:
 * values in a `Map`, `store` as the object the library would hand over, and
 * every listener told the whole object before and after each write, the way
 * the library reports its own writes too.
 */
export const createFakeStore = () => {
  const values = new Map<string, unknown>();
  const listeners = new Set<Listener>();
  const snapshot = () => Object.fromEntries(values);
  const mutate = (apply: () => void) => {
    const previous = snapshot();
    apply();
    const next = snapshot();

    for (const listener of [...listeners]) {
      listener(next, previous);
    }
  };
  const store: ElectronStore = {
    get: (key) => values.get(key),
    set: (key, value) => mutate(() => values.set(key, value)),
    delete: (key) => mutate(() => values.delete(key)),
    has: (key) => values.has(key),
    get store() {
      return snapshot();
    },
    onDidAnyChange: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return { store, values, listeners };
};
