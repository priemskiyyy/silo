import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { electronStore } from "src/electronStore";
import { createFakeStore } from "src/electronStore.fixture";
import { encodeKey } from "src/encodeKey";

testStorageAdapter({
  name: "electronStore",
  createAdapter: () => electronStore({ store: createFakeStore().store }),
  // Another process writes the same file, and the library reports a cleared
  // file as the removal of every key, never as { key: null }.
  externalWrite: (adapter, change) => {
    if (change.key === null) {
      Object.keys(adapter.native.store).forEach((key) =>
        adapter.native.delete(key),
      );
      return;
    }

    adapter.native.set(encodeKey(change.key), change.value);
  },
});
