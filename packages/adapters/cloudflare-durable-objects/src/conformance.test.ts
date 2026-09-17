import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { cloudflareDurableObjectStorage } from "src/cloudflareDurableObjectStorage";
import { createFakeDurableStorage } from "src/cloudflareDurableObjectStorage.fixture";

// Structured clone is this backend's boundary, so the corpus claims what JSON
// would flatten.
testStorageAdapter({
  name: "cloudflare-durable-object-storage",
  createAdapter: () =>
    cloudflareDurableObjectStorage({
      storage: createFakeDurableStorage().storage,
    }),
  values: {
    date: new Date("2026-01-01T00:00:00.000Z"),
    map: new Map([["key", { nested: true }]]),
    set: new Set([1, 2, 3]),
  },
});
