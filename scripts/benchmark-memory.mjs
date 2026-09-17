import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { Silo, value } from "../packages/core/dist/index.js";

const count = Number(process.argv[2] ?? 10000);
const cleanup = process.argv[3] ?? "dispose";
const workload = process.argv[4] ?? "read";
assert(
  Number.isSafeInteger(count) && count > 0,
  "Supply a positive record count.",
);
assert(["dispose", "release"].includes(cleanup), "Choose dispose or release.");
assert(
  ["read", "write", "subscribe"].includes(workload),
  "Choose read, write, or subscribe.",
);
assert.equal(typeof globalThis.gc, "function", "Run with node --expose-gc.");

const workloads = {
  read: (handle) => handle.get(),
  write: (handle) => handle.set(1),
  subscribe: (handle) => handle.subscribe(() => {}),
};
const collect = async () => {
  await setImmediate();
  globalThis.gc();
  globalThis.gc();
  return process.memoryUsage().heapUsed;
};
const create = () =>
  new Silo({
    storages: {
      default: {
        adapters: [
          {
            name: "non-retaining",
            mode: "sync",
            native: null,
            available: () => true,
            get: () => undefined,
            set: () => {},
            remove: () => {},
            dispose: () => {},
          },
        ],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });
const visit = (silo, size, handle = workloads.read) => {
  for (let index = 0; index < size; index++) {
    handle(silo.scope(String(index)).value("count"));
  }
};
let warmup = create();
visit(warmup, 1000, workloads[workload]);
warmup.dispose();
warmup = null;
const baseline = await collect();
let silo = create();
const started = performance.now();
visit(silo, count, workloads[workload]);
const createMs = performance.now() - started;
const live = await collect();
visit(silo, count);
const reread = await collect();
const inspectStarted = performance.now();
assert.equal(silo.diagnostics.get().records.length, count);
const inspectMs = performance.now() - inspectStarted;
const inspected = await collect();
let retained = silo.scope("0").value("count");
retained.set(1);
const refreshStarted = performance.now();
assert.equal(silo.diagnostics.get().records.length, count);
const refreshMs = performance.now() - refreshStarted;
const cleanupStarted = performance.now();
await silo[cleanup]();
const cleanupMs = performance.now() - cleanupStarted;
const cleaned = await collect();
assert.equal(silo.diagnostics.get().records.length, 0);
assert.equal(retained.get(), 1);
silo = null;
const oldHandle = await collect();
assert.equal(retained.get(), 1);
retained = null;
const released = await collect();
const mib = (bytes) => Number((bytes / 1024 ** 2).toFixed(2));
console.log(
  JSON.stringify(
    {
      node: process.version,
      count,
      workload,
      liveMiB: mib(live - baseline),
      bytesPerRecord: Math.round((live - baseline) / count),
      rereadAddedMiB: mib(reread - live),
      diagnostics: {
        firstMs: Number(inspectMs.toFixed(2)),
        refreshMs: Number(refreshMs.toFixed(2)),
        addedMiB: mib(inspected - reread),
      },
      cleanup: {
        mode: cleanup,
        ms: Math.round(cleanupMs),
        retainedMiB: mib(cleaned - baseline),
      },
      oldHandleMiB: mib(oldHandle - baseline),
      releasedMiB: mib(released - baseline),
      createMs: Math.round(createMs),
    },
    null,
    2,
  ),
);
