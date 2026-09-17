import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { sessionStorage } from "src/sessionStorage";

testStorageAdapter({
  name: "sessionStorage",
  createAdapter: () => sessionStorage(),
  // The `storage` event never fires in the tab that wrote, so another tab is
  // the only thing a harness can play, and it plays it by dispatching one.
  externalWrite: (adapter, change) => {
    globalThis.dispatchEvent(
      new StorageEvent("storage", {
        key: change.key,
        newValue: change.key === null ? null : JSON.stringify(change.value),
        storageArea: adapter.native,
      }),
    );
  },
});
