import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { Silo, value } from "../packages/core/dist/index.js";

assert.equal(typeof globalThis.gc, "function", "Run with node --expose-gc.");

const create = (mode = "sync", migrations) =>
  new Silo({
    migrations,
    storages: {
      default: {
        adapters: [
          {
            name: "non-retaining",
            mode,
            native: null,
            available: () => true,
            get: () => (mode === "sync" ? undefined : new Promise(() => {})),
            set: () => (mode === "sync" ? undefined : new Promise(() => {})),
            remove: () => {},
            dispose: () => {},
          },
        ],
        schema: { count: value({ fallback: 0 }) },
      },
    },
  });

const collected = async (reference, message) => {
  for (let attempt = 0; attempt < 20; attempt++) {
    // WeakRef.deref keeps its target alive until the current job ends.
    await setImmediate();
    globalThis.gc();
    await setImmediate();
    if (reference.deref() === undefined) {
      return;
    }
  }
  assert.fail(message);
};

const disposed = (() => {
  const silo = create();
  const retained = silo.value("count");
  const abandoned = new WeakRef(silo.scope("abandoned").value("count"));
  silo.dispose();
  return { silo, retained, abandoned };
})();
await collected(
  disposed.abandoned,
  "A disposed Silo retained unrelated records.",
);
assert.equal(disposed.retained.get(), 0);
assert.equal(disposed.silo.diagnostics.get().records.length, 0);

const released = await (async () => {
  const silo = create();
  const scope = silo.scope("account");
  const retained = scope.value("count");
  const abandoned = new WeakRef(scope.scope("abandoned").value("count"));
  await scope.release();
  return { silo, retained, abandoned };
})();
await collected(
  released.abandoned,
  "A released scope retained unrelated records.",
);
assert.equal(released.retained.get(), 0);
assert.equal(released.silo.diagnostics.get().records.length, 0);
released.silo.dispose();

const orphan = await (async () => {
  const silo = create();
  const retained = silo.scope("account").value("count");
  silo.scope("other").value("count");
  await silo.scope("account").release();
  return { retained, store: new WeakRef(silo) };
})();
await collected(
  orphan.store,
  "An inactive value handle retained its former Silo.",
);
assert.equal(orphan.retained.get(), 0);

for (const operation of ["hydration", "write"]) {
  const interrupted = (() => {
    const silo = create("async");
    const retained = silo.value("count");
    retained.hydrated().catch(() => {});
    if (operation === "write") {
      retained.set(1);
    }
    silo.dispose();
    return { retained, store: new WeakRef(silo) };
  })();
  await collected(
    interrupted.store,
    `A cancelled ${operation} retained its former Silo.`,
  );
  if (operation === "write") {
    await assert.rejects(interrupted.retained.flush(), /disposed/);
    continue;
  }
  await assert.rejects(interrupted.retained.hydrated(), /disposed/);
}

const migrating = await (async () => {
  const silo = create("async", { 1: () => {} });
  const scope = silo.scope("account");
  const abandoned = new WeakRef(scope.value("count"));
  await scope.release();
  return { silo, abandoned };
})();
await collected(
  migrating.abandoned,
  "Migration admission retained a released record.",
);
migrating.silo.dispose();

const inspector = (() => {
  const silo = create();
  const diagnostics = silo.diagnostics;
  silo.value("count");
  diagnostics.get();
  silo.dispose();
  return { diagnostics, store: new WeakRef(silo) };
})();
await collected(
  inspector.store,
  "Disposed diagnostics retained its former Silo.",
);
assert.equal(inspector.diagnostics.get().records.length, 0);

const hydration = await (async () => {
  const silo = create("async");
  const count = silo.value("count");
  const promise = count.hydrated();
  count.set(1);
  await promise;
  return { silo, promise: new WeakRef(promise) };
})();
await collected(
  hydration.promise,
  "An active record retained its completed hydration promise.",
);
assert.equal(hydration.silo.value("count").get(), 1);
await hydration.silo.value("count").hydrated();
hydration.silo.dispose();

for (const mode of ["sync", "async"]) {
  const listeners = new Set();
  const adapter = {
    name: "non-retaining",
    mode,
    native: null,
    available: () => true,
    get: () => (mode === "sync" ? undefined : Promise.resolve()),
    set: () => (mode === "sync" ? undefined : Promise.resolve()),
    remove: () => (mode === "sync" ? undefined : Promise.resolve()),
    observe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {},
  };
  const completed = await (async () => {
    const captured = { version: 1 };
    const silo = new Silo({
      storages: {
        default: {
          adapters: [adapter],
          schema: { count: value({ fallback: 0 }) },
        },
      },
      migrations: { 1: (store) => store.set("marker", captured.version) },
    });
    await silo.ready();
    return { silo, captured: new WeakRef(captured) };
  })();
  await collected(
    completed.captured,
    `A completed ${mode} migration retained its captured data.`,
  );
  assert.equal(completed.silo.diagnostics.get().version.stored, 1);
  const count = completed.silo.value("count");
  for (const listener of listeners) {
    listener({ key: "silo:count", value: 7 });
  }
  assert.equal(count.get(), 7);
  completed.silo.dispose();
  assert.equal(listeners.size, 0);
}

console.log(
  "Memory checks passed: disposed records, released scopes, old handles, diagnostics, completed hydration, and migration captures are collectible.",
);
