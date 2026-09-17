import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { tauriStore } from "src/tauriStore";
import { fakeTauriStore } from "src/tauriStore.fixture";

testStorageAdapter({
  name: "tauriStore",
  createAdapter: () => tauriStore({ store: fakeTauriStore().store }),
  // Another window writes through the same store, and the plugin reports a
  // clear as one deletion per key, never as { key: null }.
  externalWrite: async (adapter, change) => {
    if (change.key === null) {
      for (const key of await adapter.native.keys()) {
        await adapter.native.delete(key);
      }

      return;
    }

    await adapter.native.set(change.key, change.value);
  },
});
