import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { secureStore } from "src/secureStore";
import { createFakeSecureStore } from "src/secureStore.fixture";

testStorageAdapter({
  name: "expo-secure-store",
  createAdapter: () => secureStore({ store: createFakeSecureStore().module }),
});
