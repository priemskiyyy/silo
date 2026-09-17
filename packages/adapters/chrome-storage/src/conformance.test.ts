import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { chromeStorage } from "src/chromeStorage";
import { fakeArea } from "src/fakeArea.fixture";

testStorageAdapter({
  name: "chromeStorage",
  createAdapter: () => chromeStorage({ area: fakeArea().area }),
  // Another extension context writes through the same area, and the
  // platform reports a clear as one removal per key, never as { key: null }.
  externalWrite: async (adapter, change) => {
    if (change.key === null) {
      await adapter.native.remove(Object.keys(await adapter.native.get(null)));
      return;
    }

    await adapter.native.set({ [change.key]: change.value });
  },
});
