import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { jsonFile } from "src/jsonFile";

const directory = mkdtempSync(join(tmpdir(), "silo-json-file-"));
let files = 0;

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

// One file per adapter: the suite creates an adapter per test and expects
// each to start cold.
testStorageAdapter({
  name: "jsonFile",
  createAdapter: () => {
    files += 1;

    return jsonFile({ path: join(directory, `${files}.json`) });
  },
});
