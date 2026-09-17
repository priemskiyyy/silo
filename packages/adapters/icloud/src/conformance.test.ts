import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { icloud } from "src/icloud";
import { createFakeCloudStore } from "src/icloud.fixture";

const fakes = new WeakMap<object, ReturnType<typeof createFakeCloudStore>>();

testStorageAdapter({
  name: "icloud",
  createAdapter: () => {
    const fake = createFakeCloudStore();
    fakes.set(fake.module, fake);

    return icloud({ store: fake.module });
  },
  // Another device wrote, iCloud applied it here, and then named the keys.
  // A store replaced wholesale, as on an account change, names none.
  externalWrite: (adapter, change) => {
    const fake = fakes.get(adapter.native);

    if (fake === undefined) {
      throw new Error("the adapter under test was not built here");
    }

    if (change.key === null) {
      fake.store.clear();
      fake.remote({ reason: 3 });
      return;
    }

    fake.store.set(change.key, JSON.stringify(change.value));
    fake.remote({ reason: 0, changedKeys: [change.key] });
  },
});
