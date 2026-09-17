import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { cookie } from "src/cookie";

// Cookies are JSON encoded, so the corpus is the JSON-safe default, and
// nothing observes them, so the observation block does not run.
testStorageAdapter({
  name: "cookie",
  createAdapter: () => cookie(),
});
