import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { keychain } from "src/keychain";
import { createFakeKeychain } from "src/keychain.fixture";

testStorageAdapter({
  name: "react-native-keychain",
  createAdapter: () => keychain({ keychain: createFakeKeychain().module }),
});
