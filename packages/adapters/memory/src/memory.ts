import { createStorageAdapter } from "@priemskiyyy/silo";
import { cloneValue } from "src/cloneValue";
import type { MemoryAdapterOptions } from "src/types/MemoryAdapterOptions";
import type { MemoryStore } from "src/types/MemoryStore";

/**
 * Keeps structured clones in a Map. Disposal clears the stored values.
 *
 * @example
 * ```ts
 * const adapter = memory();
 * adapter.set("theme", "dark");
 * ```
 */
export const memory = ({
  available = () => true,
}: MemoryAdapterOptions = {}) => {
  const store: MemoryStore = new Map();

  return createStorageAdapter({
    mode: "sync",
    name: "memory",
    native: store,
    get: (key) => cloneValue(store.get(key)),
    set: (key, value) => {
      store.set(key, cloneValue(value));
    },
    remove: (key) => {
      store.delete(key);
    },
    keys: () => [...store.keys()],
    available,
    dispose: () => {
      store.clear();
    },
  });
};
