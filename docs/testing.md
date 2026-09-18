---
description: "Test a Silo application without a browser or timers: the mock storage adapter, held reads, external changes, refused writes, migrations, expiry and cleanup."
---

# Testing an application

Application code that uses Silo needs no browser, no backend and no real
timers. `@priemskiyyy/silo/mock` exports `createMockAdapter`, a deliberately
badly behaved adapter that records every call, lets a test hold an operation
open and settle or fail it later, and emits external changes on demand. For a
plain fixture with no controls, `memory()` from `@priemskiyyy/silo-memory`
works in every runtime.

This page is about testing an application. For testing an adapter you wrote,
see [Testing an adapter](testing-adapters.md).

```sh
pnpm add -D @priemskiyyy/silo @priemskiyyy/silo-memory
```

## The controls

```ts
import { createMockAdapter } from "@priemskiyyy/silo/mock";

const mock = createMockAdapter();

// mock.adapter        the adapter to list in a storage
// mock.store          the backing Map, keyed by physical key
// mock.calls          every get, set and remove, in order
// mock.emit(change)   report an external change to every observer
// mock.disposeCount() how many times the adapter was disposed
export const controls = mock;
```

`mock.store` is the whole backend, so seeding it is how a test says "this is
what was already persisted". The key is the physical key the core composes,
`${namespace}:${...segments}:${key}`, namespaced `silo` by default, and the
version record is `silo::version`. See [Scopes](scopes.md) and
[Storages and namespaces](storages.md).

| Option             | Default  | Effect                                                                                          |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `mode`             | `"sync"` | `"async"` produces an `AsyncStorageAdapter`, typed by an overload so it is accepted only there. |
| `hold`             | `false`  | Async only: every operation stays open until the test settles its recorded call, in any order.  |
| `onCall`           |          | Runs inside every operation once the call is recorded. Throw to fail that one operation.        |
| `observe`          | `true`   | `false` drops `observe` from the adapter, for code paths that must cope without observation.    |
| `keys`             | `true`   | `false` drops `keys`, so a migration that enumerates throws the way it would on such a backend. |
| `available`        | `true`   | What the availability probe answers, for testing a candidate list that falls through.           |
| `emitAfterDispose` | `false`  | Keeps `emit` delivering after `dispose`, which a conforming adapter never does.                 |

## Read what was persisted

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

const Schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
};

test("a synchronous store reads persisted data on the first get", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  expect(silo.value("theme").get()).toBe("dark");

  silo.dispose();
});
```

On a synchronous adapter with no pending migration there is nothing to await:
the record hydrates inside `silo.value(key)`. On an asynchronous one the first
`get()` returns the fallback and the persisted value arrives later, which is
what the next section is for.

## Hold an operation open to test a loading state

`{ mode: "async", hold: true }` makes every operation stay open until the test
settles its recorded call. Nothing resolves on its own, so a loading state is
observable for exactly as long as the test wants it:

```tsx
import { act, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import {
  SiloProvider,
  useValue,
  useValueStatus,
} from "@priemskiyyy/silo-react";

const Schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
};

const Theme = () => {
  const [theme] = useValue("theme");
  const status = useValueStatus("theme");

  return <p>{status.state === "hydrating" ? "loading" : String(theme)}</p>;
};

test("the value renders loading until hydration lands", async () => {
  const mock = createMockAdapter({ mode: "async", hold: true });
  mock.store.set("silo:theme", "dark");
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });

  render(
    <SiloProvider silo={silo}>
      <Theme />
    </SiloProvider>,
  );

  expect(screen.getByText("loading").textContent).toBe("loading");

  const read = mock.calls[0];

  if (read === undefined) {
    throw new Error("Expected the mounted component to read the value");
  }

  await act(async () => {
    read.settle();
    await silo.value("theme").hydrated();
  });

  expect(screen.getByText("dark").textContent).toBe("dark");

  silo.dispose();
});
```

The guard is explicit rather than an optional call: a test that skips its own
assertion because `calls[0]` was `undefined` passes while proving nothing.

`settle()` applies the operation to the store and resolves it. `fail(error)`
rejects it and leaves the store untouched, which is how a test drives a read
that throws or a write the backend refused. Settling a call twice throws.

## Drive a change from another tab

`mock.emit` reports a change to every observer without touching the store, so
the reported change and the stored value are controlled separately:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

const Schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
};

test("a change from another tab reaches the value", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");

  mock.emit({ key: "silo:theme", value: "dark" });

  expect(theme.get()).toBe("dark");

  // Everything changed and the backend cannot say which keys: re-read.
  mock.store.set("silo:theme", "light");
  mock.emit({ key: null });

  expect(theme.get()).toBe("light");

  silo.dispose();
});
```

A local write always wins: an external change that arrives while a write is
in flight or queued is dropped, not merged. To test that, hold a write open,
emit, and assert the snapshot is still the written value. See
[External observation](external-observation.md).

## Test a refused write

`onCall` runs inside every operation once the call is recorded. Throwing from
it fails that one operation, which is how quota exhaustion and a disk failure
are modelled:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

const Schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
};

test("a refused write never throws out of set", async () => {
  const mock = createMockAdapter({
    onCall: (call) => {
      if (call.operation !== "set") {
        return;
      }

      throw new Error("quota exceeded");
    },
  });
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
  });
  const theme = silo.value("theme");

  // No throw: a write failure is a status, never an exception in an event
  // handler.
  theme.set("dark");

  expect(theme.status.get()).toEqual({
    state: "error",
    error: { phase: "write", cause: new Error("quota exceeded") },
  });
  // The optimistic snapshot is kept, so a reader still sees what was asked for.
  expect(theme.get()).toBe("dark");
  await expect(theme.flush()).rejects.toThrow("quota exceeded");

  silo.dispose();
});
```

[Errors and recovery](errors-and-recovery.md) covers what the core does with
each failure.

## Test a candidate list

`available` answers the probe, so a test can prove that the application still
works when its first choice is missing, and that the store says which adapter
won:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { memory } from "@priemskiyyy/silo-memory";

test("a blocked first choice falls through to memory", () => {
  const blocked = createMockAdapter({ available: false });
  const silo = new Silo({
    storages: {
      default: {
        adapters: [blocked.adapter, memory()],
        schema: { theme: value({ fallback: "light" }) },
      },
    },
  });

  expect(silo.diagnostics.get().storages[0]?.adapter).toBe("memory");
  expect(blocked.calls).toEqual([]);

  silo.dispose();
});
```

The last candidate is never probed; it is the floor. See
[Storages and namespaces](storages.md).

## Test a migration

Plant the old shape, construct the store with the step, and assert both the
value and the version record. On synchronous adapters the whole chain runs in
the constructor:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

test("version 2 renames the theme key", () => {
  const mock = createMockAdapter();
  mock.store.set("silo:legacyTheme", "dark");
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
      },
    },
    migrations: {
      2: (store) => {
        store.rename("legacyTheme", "theme");
      },
    },
  });

  expect(silo.value("theme").get()).toBe("dark");
  expect(mock.store.has("silo:legacyTheme")).toBe(false);
  expect(mock.store.get("silo::version")).toBe(2);

  silo.dispose();
});
```

With an asynchronous adapter anywhere in the store, `await silo.ready()`
before reading, and assert `silo.status.get()` is `{ state: "error", ... }`
for a step that throws. A failed chain leaves the stored version at the last
step that landed, so the same test can construct a second store over the same
`mock.store` and prove the retry resumes there. See
[Migrations](migrations.md).

## Assert persistence without real timers

Two habits make a test deterministic:

- **`await value.flush()` rather than a timeout.** The barrier resolves when
  every accepted mutation has reached the adapter, and rejects with the
  failure when one did not. A mutation that was coalesced away is satisfied by
  the write that superseded it, so a flush never hangs on a write the core
  decided not to make. See [Hydration and flush](hydration-and-flush.md).
- **`now` rather than fake timers.** Expiry is measured against the clock
  passed to the constructor, so it is tested by moving a number:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

test("an expired value reads absent and is deleted", async () => {
  const mock = createMockAdapter();
  const Schema = { token: value<string>({ expires: { in: 60_000 } }) };
  let clock = 0;
  const silo = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    now: () => clock,
  });

  silo.value("token").set("abc");
  await silo.flush();

  expect(mock.store.get("silo:token")).toEqual({
    value: "abc",
    expires: { at: 60_000 },
  });

  clock = 60_001;
  const reloaded = new Silo({
    storages: { default: { adapters: [mock.adapter], schema: Schema } },
    now: () => clock,
  });

  expect(reloaded.value("token").get()).toBeUndefined();

  await reloaded.flush();

  expect(mock.store.get("silo:token")).toBeUndefined();

  silo.dispose();
  reloaded.dispose();
});
```

Only a key that declares `expires` is enveloped, which is why the raw value
above is `{ value, expires: { at } }` and every other key's raw is bare. See
[Expiring values](ttl.md).

## Assert cleanup

`mock.disposeCount()` counts disposals, so a test can prove teardown released
what it created:

```ts
import { expect, test } from "vitest";
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

test("disposing the store disposes its adapter once", () => {
  const mock = createMockAdapter();
  const silo = new Silo({
    storages: {
      default: {
        adapters: [mock.adapter],
        schema: { theme: value({ fallback: "light" }) },
      },
    },
  });

  silo.dispose();
  silo.dispose();

  expect(mock.disposeCount()).toBe(1);
});
```

`dispose()` is idempotent on both the store and the adapter. A write already
sent to the adapter still completes; one queued behind it does not, so
`await silo.flush()` before disposing when the last write has to land. A
candidate that lost its list is disposed at construction, so a mock listed
behind a winner reports one disposal before any test code runs.

## Choose the right layer

| Layer                 | Proves                                                                 | Does not prove                              |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| Mock adapter          | UI updates, loading states, coalescing, failure handling, cleanup      | That a real backend behaves this way        |
| Memory adapter        | Schema and codec round trips against structured clone                  | That the same values survive a text backend |
| Real adapter in jsdom | Encoding, key composition, the adapter's own filtering                 | Real cross-tab delivery, real quota         |
| Playwright            | Real IndexedDB, a real cross-tab `storage` event, a real quota refusal | Nothing beyond the browsers it runs         |

A passing mock test is not evidence that `localStorage` accepted the write.
The repository keeps two Playwright suites for the claims that need a browser:
`tests/browser` drives a small Vite page over real IndexedDB, web storage and
two tabs, and `examples/fieldbook.spec.ts` walks the
[Fieldbook example](examples.md) at phone and desktop widths, reloads it,
refuses a write and checks what the devtools list.
