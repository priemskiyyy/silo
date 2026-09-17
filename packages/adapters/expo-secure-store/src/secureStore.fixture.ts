import type { SecureStoreModule } from "src/types/SecureStoreModule";

// The native module is not installable here, so the fake is its contract: a
// string store that refuses the keys SecureStore refuses, which is what makes
// the suite's opaque-key block prove the encoding.
export const createFakeSecureStore = () => {
  const items = new Map<string, string>();
  const assertKey = (key: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      throw new Error(`SecureStore refuses the key "${key}".`);
    }
  };
  const module: SecureStoreModule = {
    getItemAsync: async (key) => {
      assertKey(key);
      return items.get(key) ?? null;
    },
    setItemAsync: async (key, value) => {
      assertKey(key);
      items.set(key, value);
    },
    deleteItemAsync: async (key) => {
      assertKey(key);
      items.delete(key);
    },
  };

  return { items, module };
};
