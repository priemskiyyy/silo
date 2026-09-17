import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { createFakeMmkv } from "src/mmkv.fixture";
import { mmkv } from "src/mmkv";

testStorageAdapter({
  name: "mmkv",
  createAdapter: () => mmkv({ storage: createFakeMmkv().storage }),
  // Another part of the application writes through the same instance, and
  // MMKV has no clear signal: a cleared instance is reported key by key.
  externalWrite: (adapter, change) => {
    if (change.key === null) {
      adapter.native.getAllKeys().forEach((key) => adapter.native.delete(key));
      return;
    }

    adapter.native.set(change.key, JSON.stringify(change.value));
  },
});
