import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { capacitorPreferences } from "src/capacitorPreferences";
import { createFakePreferences } from "src/capacitorPreferences.fixture";

testStorageAdapter({
  name: "capacitor-preferences",
  createAdapter: () =>
    capacitorPreferences({ preferences: createFakePreferences().plugin }),
});
