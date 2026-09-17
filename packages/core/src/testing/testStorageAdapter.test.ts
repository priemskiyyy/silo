import type { StorageChange } from "src/types/StorageChange";
import type { MockNative } from "src/mock/createMockAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";
import { testStorageAdapter } from "src/testing/testStorageAdapter";

// Another tab's write: the store changes and the change is reported, which is
// exactly the pair a real backend's `observe` delivers.
const externalWrite = (native: MockNative, change: StorageChange) => {
  if (change.key === null) {
    native.store.clear();
    native.emit(change);

    return;
  }

  native.store.set(change.key, change.value);
  native.emit(change);
};

// The mock's store keeps live references, so anything structured-clonable
// round-trips through it and the corpus option is exercised too.
const values = {
  date: new Date("2024-01-01T00:00:00.000Z"),
  map: new Map([["key", "value"]]),
  set: new Set([1, 2, 3]),
};

testStorageAdapter({
  name: "mock sync",
  createAdapter: () => createMockAdapter().adapter,
  values,
  externalWrite: (adapter, change) => externalWrite(adapter.native, change),
});

testStorageAdapter({
  name: "mock async",
  createAdapter: () => createMockAdapter({ mode: "async" }).adapter,
  values,
  externalWrite: (adapter, change) => externalWrite(adapter.native, change),
});
