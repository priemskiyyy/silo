import { DatabaseSync } from "node:sqlite";
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { sqlite } from "src/sqlite";

// The real node:sqlite, in memory: what the suite proves here holds for
// better-sqlite3 and bun:sqlite too, because the adapter only ever calls the
// three statement methods all of them share.
testStorageAdapter({
  name: "sqlite",
  createAdapter: () => sqlite({ database: new DatabaseSync(":memory:") }),
});
