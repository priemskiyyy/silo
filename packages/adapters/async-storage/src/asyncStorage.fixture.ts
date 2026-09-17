import type { AsyncStorageInstance } from "src/types/AsyncStorageInstance";

/** An in-process stand-in for AsyncStorage, for the tests: strings in a `Map`, answered a tick later. */
export const createFakeAsyncStorage = () => {
  const store = new Map<string, string>();
  const storage: AsyncStorageInstance = {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
    getAllKeys: async () => [...store.keys()],
  };

  return { store, storage };
};
