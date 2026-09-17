import assert from "node:assert/strict";
import { createHook } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { Silo, value } from "../packages/core/dist/index.js";

const records = Number(process.argv[2] ?? 50000);
const writes = Number(process.argv[3] ?? 500000);
assert(
  Number.isSafeInteger(records) && records > 0,
  "Choose a positive record count.",
);
assert(
  Number.isSafeInteger(writes) && writes > 0,
  "Choose a positive write count.",
);

const silo = new Silo({
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
for (let index = 0; index < records; index++) {
  silo.scope(String(index)).value("count");
}
for (let index = 0; index < 10; index++) {
  await silo.flush();
}
const flushSamples = [];
for (let index = 0; index < 20; index++) {
  const started = performance.now();
  await silo.flush();
  flushSamples.push(performance.now() - started);
}
let promises = 0;
const hook = createHook({
  init: (_id, type) => {
    if (type === "PROMISE") {
      promises++;
    }
  },
});
hook.enable();
try {
  await silo.flush();
} finally {
  hook.disable();
}

const median = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
};
const writeResults = {};
const handle = silo.scope("0").value("count");
for (const mode of ["unobserved", "observed"]) {
  let events = 0;
  const stop =
    mode === "observed"
      ? silo.diagnostics.events.subscribe(() => {
          events++;
        })
      : () => {};
  for (let index = 0; index < 10000; index++) {
    handle.set(index);
  }
  events = 0;
  const samples = [];
  for (let sample = 0; sample < 5; sample++) {
    const started = performance.now();
    for (let index = 0; index < writes; index++) {
      handle.set(index);
    }
    samples.push(performance.now() - started);
  }
  stop();
  assert.equal(handle.get(), writes - 1);
  assert.equal(events, mode === "observed" ? writes * 5 * 2 : 0);
  writeResults[mode] = { medianMs: median(samples), events };
}
silo.dispose();
console.log(
  JSON.stringify(
    {
      node: process.version,
      records,
      cleanFlush: { medianMs: median(flushSamples), promises },
      writes,
      diagnostics: writeResults,
    },
    null,
    2,
  ),
);
