import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { unstorage } from "src/unstorage";

// The real library over its memory driver, so key normalization and value
// parsing are the ones every driver goes through.
testStorageAdapter({
  name: "unstorage",
  createAdapter: () =>
    unstorage({ storage: createStorage({ driver: memoryDriver() }) }),
});
