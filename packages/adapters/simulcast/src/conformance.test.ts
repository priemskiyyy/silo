import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { createRealtime } from "src/realtime.fixture";
import { simulcast } from "src/simulcast";

// One client for the whole file: every adapter listens on the same channel,
// and a disposed one has released its subscription, so `announce` reaches
// only the adapter under test.
const realtime = createRealtime();

// Another device writes to the shared backend, and the server announces it.
const externalWrite = (
  store: Map<string, unknown>,
  change: Exclude<Parameters<typeof realtime.announce>[0], { error: unknown }>,
) => {
  if (change.key === null) {
    store.clear();
    realtime.announce(change);
    return;
  }

  store.set(change.key, change.value);
  realtime.announce(change);
};

testStorageAdapter({
  name: "simulcast over a synchronous adapter",
  createAdapter: () =>
    simulcast({
      adapter: createMockAdapter().adapter,
      channel: realtime.channel,
    }),
  externalWrite: (adapter, change) =>
    externalWrite(adapter.native.store, change),
});

testStorageAdapter({
  name: "simulcast over an asynchronous adapter",
  createAdapter: () =>
    simulcast({
      adapter: createMockAdapter({ mode: "async" }).adapter,
      channel: realtime.channel,
    }),
  externalWrite: (adapter, change) =>
    externalWrite(adapter.native.store, change),
});
