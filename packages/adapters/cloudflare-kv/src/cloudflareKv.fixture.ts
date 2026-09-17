import type { KvNamespace } from "src/types/KvNamespace";

const PAGE = 2;

// A namespace for the tests: text in a Map, and `list` paginated in pages of
// two so the cursor loop runs however few keys there are.
export const createFakeKvNamespace = () => {
  const store = new Map<string, string>();
  const lists: Array<{ cursor?: string }> = [];
  const namespace: KvNamespace = {
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    list: async (options = {}) => {
      lists.push(options);
      const names = [...store.keys()];
      const start = options.cursor === undefined ? 0 : Number(options.cursor);
      const keys = names.slice(start, start + PAGE).map((name) => ({ name }));
      const next = start + PAGE;

      return next >= names.length
        ? { keys, list_complete: true }
        : { keys, list_complete: false, cursor: String(next) };
    },
  };

  return { store, lists, namespace };
};
