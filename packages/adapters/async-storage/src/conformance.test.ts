import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { asyncStorage } from "src/asyncStorage";
import { createFakeAsyncStorage } from "src/asyncStorage.fixture";

testStorageAdapter({
  name: "asyncStorage",
  createAdapter: () =>
    asyncStorage({ storage: createFakeAsyncStorage().storage }),
});
