import type { PreferencesPlugin } from "src/types/PreferencesPlugin";

// The plugin is not installable here, so the fake is its contract: a string
// store in a Map, because the suite writes keys such as `__proto__`.
export const createFakePreferences = () => {
  const items = new Map<string, string>();
  const plugin: PreferencesPlugin = {
    get: async ({ key }) => ({ value: items.get(key) ?? null }),
    set: async ({ key, value }) => {
      items.set(key, value);
    },
    remove: async ({ key }) => {
      items.delete(key);
    },
    keys: async () => ({ keys: [...items.keys()] }),
  };

  return { items, plugin };
};
