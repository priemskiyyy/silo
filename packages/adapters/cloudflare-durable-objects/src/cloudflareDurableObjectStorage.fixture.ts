import type { DurableStorage } from "src/types/DurableStorage";

// A Durable Object's storage for the tests: a Map of structured clones, the
// way the runtime keeps values.
export const createFakeDurableStorage = () => {
  const store = new Map<string, unknown>();
  const storage: DurableStorage = {
    get: async (key) => structuredClone(store.get(key)),
    put: async (key, value) => {
      store.set(key, structuredClone(value));
    },
    delete: async (key) => store.delete(key),
    list: async () => structuredClone(store),
  };

  return { store, storage };
};
