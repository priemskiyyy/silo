---
description: "Run the Silo storage adapter conformance suite: options, the value corpus, the external write harness, enumeration, fakes for hosted backends and Vitest."
---

# Testing an adapter

`@priemskiyyy/silo/testing` exports `testStorageAdapter`, the Vitest suite
every adapter runs. It checks the parts of the contract that are the same for
every backend, so an adapter's own tests are free to cover only what is
specific to it.

This page shows how to test an adapter. See [backend test coverage](verification.md)
for the environments used by shipped adapters, or [application testing](testing.md)
for testing code that uses Silo.

```sh
pnpm add -D @priemskiyyy/silo vitest
```

`vitest` is an optional peer dependency of `@priemskiyyy/silo`, and importing
`@priemskiyyy/silo/testing` is the only thing that needs it. The subpath is
kept separate from the root barrel so Vitest never reaches a consumer's bundle.

## Run it

One call, in `src/conformance.test.ts` beside the adapter:

```ts
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { memory } from "@priemskiyyy/silo-memory";

testStorageAdapter({ name: "memory", createAdapter: () => memory() });
```

`createAdapter` is called once per test, and once more before any test runs
to read `mode` and whether `observe` and `keys` are present. Every adapter it
creates is disposed by the test that created it.

## The options

| Option          | Required | Meaning                                                                                                               |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`          | yes      | Labels the generated `describe` blocks and appears in every assertion message, so a failure says which adapter broke. |
| `createAdapter` | yes      | Creates a cold adapter. Its return type decides which mode block runs.                                                |
| `values`        | no       | Values this backend must round-trip, added to the JSON-safe corpus.                                                   |
| `externalWrite` | no       | Applies a change from outside the adapter, the way another tab would. The observation block is skipped without it.    |

## The value corpus

The suite always round-trips a JSON-safe corpus: a string, an empty string, a
number, zero, a negative fraction, both booleans, an empty array, a mixed
array, an empty object and a nested object. `values` adds to it.

Use the corpus to verify the value types your adapter promises to preserve.
For example, structured storage can support additional types:

```ts
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";

testStorageAdapter({
  name: "indexeddb",
  createAdapter: () => indexedDb({ name: "conformance" }),
  // Structured clone carries these; a JSON backend must not claim them.
  values: {
    date: new Date("2026-01-01T00:00:00.000Z"),
    map: new Map([["one", 1]]),
    set: new Set(["a", "b"]),
    "typed array": new Uint8Array([1, 2, 3]),
    blob: new Blob(["hello"], { type: "text/plain" }),
  },
});
```

Only add values the adapter can preserve. For example, a Date case fails on a
plain JSON adapter because it reads back as a string. An adapter with a
`format` option can run the suite twice, once with JSON and once with
`superjson`, and pass a wider corpus to the second run.

Two members of the corpus are not optional and are asserted separately: `null`
round-trips and stays distinct from an absent key, and an absent key reads
`undefined`.

## The external write harness

`externalWrite` applies a change from outside the adapter, the way another
tab, process or device would. The observation block is skipped entirely
without it, and also when the adapter has no `observe`.

```ts
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { sessionStorage as sessionStorageAdapter } from "@priemskiyyy/silo-session-storage";

testStorageAdapter({
  name: "session-storage",
  createAdapter: () => sessionStorageAdapter(),
  // The `storage` event never fires in the tab that wrote, so another tab is
  // the only thing a harness can play, and it plays it by dispatching one.
  externalWrite: (adapter, change) => {
    globalThis.dispatchEvent(
      new StorageEvent("storage", {
        key: change.key,
        newValue: change.key === null ? null : JSON.stringify(change.value),
        storageArea: adapter.native,
      }),
    );
  },
});
```

The harness has to reach the backend the way a foreign writer would, not
through the adapter under test. Writing through `adapter.set` would prove
nothing: the suite would then be asserting that an adapter hears itself, which
is the opposite of the contract. The harness encodes the value itself, because
the change arrives at the backend already in the backend's own representation.

A backend with no clear signal reports a clear key by key, which is what the
MMKV harness does for `{ key: null }`: it deletes every key through the native
instance and lets the listener report each one.

Three assertions run on it. An external change reaches an observer, and a
keyed report carries the physical key and the decoded value. An external clear
reports `{ key: null }` or the removal of every affected key. And an observer is silent after `dispose()`,
including one the consumer never stopped; the harness is allowed to fail at
that point, since the transport it reaches the backend through may be gone,
and the suite tolerates it.

## The enumeration block

When `createAdapter()` exposes `keys`, the suite asserts that `keys()` lists
what was written and forgets what was removed, and that it is refused after
disposal. A migration reaches scoped data through `keys`, so an adapter that
can enumerate should, and one that cannot should leave the member out rather
than answer an empty list.

## Fakes for hosted backends

Most shipped adapters wrap an instance the application hands over: an MMKV
store, a Redis client, a KV binding, an Electron store. Their conformance tests
run against a small fake of that instance, kept in `src/<name>.fixture.ts`
beside the adapter. These are repository test fixtures, not public package
exports:

```ts
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { createFakeMmkv } from "src/mmkv.fixture";
import { mmkv } from "src/mmkv";

testStorageAdapter({
  name: "mmkv",
  createAdapter: () => mmkv({ storage: createFakeMmkv().storage }),
  externalWrite: (adapter, change) => {
    if (change.key === null) {
      adapter.native.getAllKeys().forEach((key) => adapter.native.delete(key));
      return;
    }

    adapter.native.set(change.key, JSON.stringify(change.value));
  },
});
```

A fake checks how the adapter calls the SDK. It does not exercise the platform. Keep it to the methods the adapter
calls, make it behave the way the real SDK is documented to behave for those
methods, and put the platform's own failure modes in the adapter's tests.

## The synchronicity block

Mode-specific assertions live in two `describe.runIf` blocks, and only one
runs.

The synchronous block contains no `await` and no `async` callback anywhere.
Check synchronous return values directly. Awaiting them would also accept an
accidentally asynchronous implementation:

```ts
import { expect, test } from "vitest";
import { memory } from "@priemskiyyy/silo-memory";

test("every operation settles in the calling frame", () => {
  const adapter = memory();

  expect(adapter.set("silo:theme", "dark")).not.toBeInstanceOf(Promise);
  expect(adapter.get("silo:theme")).toBe("dark");
  adapter.dispose();
});
```

The asynchronous block asserts the mirror image: each operation returns a
promise, and the value is readable once it settles.

Every shared assertion goes through one `resolve` helper that checks
`result instanceof Promise === (mode === "async")` before awaiting, so an
adapter that returns a promise from a `sync` `get`, or a bare value from an
`async` one, fails on the first operation rather than in whatever it breaks
later.

## What the suite checks

- The factory reports a `name`, the `mode` every instance agrees on, and a
  `native` property, which may be `null` where the platform is absent.
- `available()` answers a boolean without touching the store.
- `native` identity is stable across operations.
- A missing key reads `undefined`; `null` round-trips and stays distinct.
- Every corpus value round-trips; a later write overwrites; `remove` deletes
  and is idempotent; removing a key that was never written is accepted; keys
  are isolated from each other.
- Keys are opaque. It writes `a:b`, leading and trailing spaces, slashes,
  query syntax, mixed case, an emoji, `__proto__` and `constructor`, then reads
  each back, and finally asserts that keys a normalizing adapter would collide
  with read `undefined`.
- `dispose()` is idempotent, and `get`, `set` and `remove` are refused after
  it, by a throw or by a rejected promise.
- With `keys`: it lists what was written, forgets what was removed, and is
  refused after disposal.
- With `observe` and a harness: an external change is reported, a clear
  reports `{ key: null }` or individual removals, and everything is silent after disposal.

## What it cannot catch

- **A cold factory.** Only the backend knows what opening a resource looks
  like, so the suite cannot assert that the factory opened nothing. Every
  shipped adapter proves it in its own tests, by spying on the platform getter
  or the fake's constructor and asserting it was not touched until the first
  operation.
- **Backend semantics.** Quota exhaustion, a `SecurityError` from a blocked
  storage getter, an IndexedDB `blocked` or `versionchange`, an HTTP 503, a
  cookie that exceeds four kilobytes: all of these belong in the adapter's own
  tests, where the platform can be made to fail on purpose.
- **The keyspace declaration.** Whether the namespace is hidden or visible is
  a property the core reads, so it is asserted in the adapter's own tests and
  in the core's, not here.
- **Real cross-tab delivery.** A dispatched `StorageEvent` is a synthetic event
  in one jsdom window. It proves the adapter's filtering and decoding, not
  that two real tabs exchange anything. The repository keeps a Playwright
  suite in `tests/browser` for that class of claim, run with
  `pnpm test:browser`.
- **Anything about the core.** Write ordering, coalescing, flush barriers,
  expiry and demand are the runtime's, not the adapter's, and are tested
  against `createMockAdapter` instead.

## Register the project

Each adapter is its own Vitest project in the root `vitest.config.ts`, with a
`src` alias onto its own source and the environment its backend needs:

```ts
project("packages/adapters", "memory"),
// Web storage needs a document, and the `storage` event is synthesized in jsdom.
project("packages/adapters", "local-storage", { environment: "jsdom" }),
// fake-indexeddb installs the IDB globals that node does not ship.
project("packages/adapters", "indexeddb", { setupFiles: ["fake-indexeddb/auto"] }),
// The rest wrap an instance the application hands over, so a fake of its
// shape is the whole platform.
project("packages/adapters", "mmkv"),
```

`node` is the default and fits every adapter that wraps a supplied
instance. `jsdom` is for the web storage areas, cookies and search params,
which need a document, a location and a history. The IndexedDB project loads
`fake-indexeddb/auto` as a setup file, to emulate IndexedDB operations. The browser suite separately checks native
transactions and supported structured values.
