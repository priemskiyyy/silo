import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { indexedDb } from "src/indexedDb";

const DATABASE = "conformance";

testStorageAdapter({
  name: "indexedDb",
  createAdapter: () => indexedDb({ name: DATABASE }),
  // IndexedDB stores structured clones, so the corpus is wider than JSON. This
  // is the whole reason the core does not serialize for the adapter.
  values: {
    date: new Date("2026-01-01T00:00:00.000Z"),
    map: new Map([["one", 1]]),
    set: new Set(["a", "b"]),
    "typed array": new Uint8Array([1, 2, 3]),
    blob: new Blob(["hello"], { type: "text/plain" }),
    "nested clone": {
      when: new Date(0),
      tags: new Set(["a"]),
      deep: [new Map([["key", { nested: true }]])],
    },
  },
  // Another tab announces its own writes on the database's channel, which is
  // the only thing this adapter can observe: IndexedDB itself has no change
  // event to listen to.
  externalWrite: (_adapter, change) => {
    const publisher = new BroadcastChannel(`silo:indexeddb:${DATABASE}:values`);
    publisher.postMessage(change);
    publisher.close();
  },
});
