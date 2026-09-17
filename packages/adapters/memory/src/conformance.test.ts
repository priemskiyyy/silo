import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { memory } from "src/memory";

const cycle: { name: string; self?: unknown } = { name: "cycle" };
cycle.self = cycle;

// `structuredClone` is this backend's encoding boundary, so the corpus claims
// exactly what it carries: everything JSON-safe, plus the values JSON would
// flatten. None of it is portable to the web storage adapters.
testStorageAdapter({
  name: "memory",
  createAdapter: () => memory(),
  values: {
    date: new Date("2026-01-01T00:00:00.000Z"),
    map: new Map([["key", { nested: true }]]),
    set: new Set([1, 2, 3]),
    "regular expression": /silo/giu,
    bigint: 9007199254740993n,
    "typed array": new Uint8Array([1, 2, 3]),
    "circular reference": cycle,
  },
});
