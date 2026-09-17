---
description: "Diagnose a Silo value that reads its fallback, a namespace in the URL, a flashing first frame, a write that never lands, stale tabs and failed migrations."
---

# Troubleshooting

Start with the value's status, then the store's, then the storage that won.
`status.get()` on any value, `silo.status.get()` for the store, and
`silo.diagnostics.get().storages` for the winners answer most of what follows
without creating demand. [Devtools](devtools.md) shows all three.

## The value reads its fallback after a reload

Work down the list; each is a different physical key or a different backend.

- **The intended adapter lost its list.** If `localStorage` was blocked, the
  probe failed and `memory()` won, so the reload started empty. Check
  `silo.diagnostics.get().storages`: the winner's `adapter` name says which.
  The data written before the block is still in the other backend, untouched.
- **The key is not the key.** A different `namespace`, a different scope, or a
  different storage composes a different physical key. The devtools record
  detail shows the physical key; compare it with what the backend holds.
- **The raw value did not decode.** The status is
  `{ state: "error", error: { phase: "hydrate" } }`. The raw is kept
  untouched so it can be inspected or migrated. Use `set` to replace it or
  `remove` to delete it.
- **It expired.** A key that declares `expires` reads as absent at or past its
  stored `expires.at` and schedules its own deletion.
- **There is no codec and no schema, so nothing validated.** `value<User>()`
  hands back whatever is on disk as a `User`. See
  [Schema and codecs](schema-and-codecs.md).

## The URL shows `silo%3Anote` instead of `note`

The namespace is in the parameter name. `searchParams()` declares its keyspace
`hidden` by default, so check for an explicit storage `namespace` or
`searchParams({ namespace: "visible" })`. Check the winner; if the
query string should never carry a prefix regardless of who wins, set
`namespace: ""` on that storage. See [Storages and namespaces](storages.md).

## The first frame flashes the fallback

On an **asynchronous adapter this is by design**. Reaching a value creates its
record and starts the read; until the read lands, the snapshot is the declared
fallback. Gate on it rather than trying to make it disappear:

```tsx
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";

export const Draft = () => {
  const [draft] = useValue("draft");
  const status = useValueStatus("draft");

  if (status.state === "hydrating") {
    return <p>Loading</p>;
  }

  return <p>{String(draft)}</p>;
};
```

Outside React, `await value.hydrated()` settles once, when the first read
completes or a write supersedes it.

On a **synchronous adapter there should be no flash at all**: hydration
happens inside `silo.value(key)`, so the first `get()` already returns
persisted data. Two things break that. A migration step that is still pending
keeps the gate closed until it lands, on every storage. And an asynchronous
candidate anywhere in the same storage's list makes that storage asynchronous,
even when the synchronous candidate won. When the default storage is
synchronous and no step is pending, the store reads the version in the same
frame and opens the gate at once, so a warm start keeps its first frame.

## The server rendered different text

A synchronous adapter reads storage during the hydrating render, and the
server could not know what is in this browser. React reports the mismatch and
regenerates the tree. Gate on `useValueStatus`, which renders
`{ state: "hydrating" }` on the server and on the hydrating render on both
adapter modes, so both sides produce identical markup. See
[Server rendering](server-rendering.md).

## My component re-renders forever

Three causes, in order of likelihood.

**The store is constructed inside a component.** Every render then builds a
new `Silo`, a new record map and a new subscription. Construct it once at
module scope and pass it to `SiloProvider`.

**A `set` runs on every render, or in an `onChange` that its own write
triggers.** A changed snapshot notifies subscribers, so a handler that keeps
producing another value can loop. `onChange` fires on subsequent updates including
external ones, so a handler that writes back into the same key loops between
tabs as well.

**A fresh object is written on every notification.** `get()` returns the
stored reference and `set(next)` stores `next` by reference, so identity only
changes when the value does. Writing `set({ ...value })` in a subscriber
restores the loop that stable identity exists to prevent.

## My write did not persist

`set()` never throws for a failed write, so nothing surfaces unless you look.
Check in this order.

1. **The value's status.** `{ state: "error", error: { phase: "write" } }`
   means the adapter refused it, and `error.cause` is what it threw. The
   optimistic snapshot is kept, so the screen shows the new value while the
   backend does not have it. `await value.flush()` rejects with the same
   cause. Quota exhaustion and a blocked storage arrive here.
2. **A migration failed.** The gate stays closed, `silo.status` is `error`,
   and every write fails with the migration's cause rather than writing
   schema-shaped values over data that is still a version behind.
3. **The store was disposed.** After `dispose()` no new mutation is accepted.
4. **A write was queued behind one in flight when the store was disposed.**
   Disposal cannot send a queued write without reordering the two.
   `await silo.flush()` before disposing when the last write has to land.
5. **The value was mutated rather than set.** Stored values are immutable;
   mutating what you passed to `set` changes the snapshot with no notification
   and nothing to persist.
6. **`encode` threw.** That is the one failure `set()` reports synchronously,
   because it is the caller's own codec, and nothing was written.

## Another tab is not updating

- **The adapter reports nothing.** `memory()` has no `observe`, and
  `indexedDb({ sharing: "single-tab" })` removes it. A store over one of those never
  sees an external change. [External observation](external-observation.md)
  lists what each adapter reports.
- **The backend is not shared.** A `sessionStorage` area is private to its
  tab, and a `memory()` floor is private to its page.
- **The URL is per tab.** `searchParams()` reports only this tab's navigation.
  `searchParams({ sharing: "cross-tab" })` announces writes to the other tabs on the
  same path and writes theirs into this URL.
- **The writer was not another Silo adapter.** `indexedDb()` has no native
  change feed. It hears `BroadcastChannel` announcements from other Silo
  adapters on the same database, and nothing else. The `http()` adapter hears
  nothing unless wrapped in `simulcast()`, whose channel carries the
  announcement.
- **The keys differ.** Two stores must agree on `namespace`, the scope
  segments, the storage and the schema key to be talking about the same
  physical key.
- **The value was never reached in this tab.** A change for a key with no
  record is ignored; nothing is subscribed to it. Reaching it later hydrates it
  from the adapter, so nothing is lost.
- **A local write was in flight.** An external change that arrives while a
  write is in flight or queued is dropped, so the local write wins. The
  devtools timeline shows it as `outside dropped`.
- **The event does not fire in the writing tab.** The `storage` event never
  reaches the context that made the change. Two tabs are needed to see
  anything, and a test needs a synthetic `StorageEvent`.

## A migration failed and the store is closed

`silo.status.get()` is `{ state: "error", error: { phase: "migrate", cause } }`,
`ready()` rejected, and every write fails with the same cause. The stored version
is the last step that landed, so the next start resumes at the failed step.
Fix the step or the data it tripped over. Write steps that tolerate rerunning:
read what is there, decide, and write only when the shape is the old one. Two
tabs opening cold at once can run the same step, since concurrent
initialization is not locked. See [Migrations](migrations.md).

## hydrated() rejects

The promise rejects, with a message naming the key, when the record went away
before its first read landed: the store was disposed, or the scope holding
the record was released. Await `hydrated()` on a handle you still own, and do
not release a scope while a consumer is still waiting on it. See
[Scopes](scopes.md).

On `indexedDb()`, a promise that never settles is different: an open request
blocked by another connection holding the database at an older version stays
pending, and every read and write behind it does too. The adapter logs a
warning naming the database. Close the other tab, or stop pinning `version`.

## Nothing happens on the server

Expected, on every browser-only adapter. Nothing runs at import, nothing runs
in the factory, `available()` answers `false`, and the next candidate wins.
A list that ends in `memory()` constructs everywhere. A list with a single
browser adapter and no floor gets that adapter regardless: `get` reads
`undefined`, so every value takes its fallback, and `set` throws an error
naming the adapter and the key, which the core turns into a write error
status. See [Server rendering](server-rendering.md).

## TypeScript rejects the key

- **`Argument of type '"token"' is not assignable`** in `silo.value()`: the
  key is declared in a storage other than `default`, so it is addressed as
  `secure.token`. Only the default storage's keys are bare.
- **`useValue("theme")` reads `unknown`**: `Register` is not augmented. Declare
  it once, next to the store:

```ts
declare module "@priemskiyyy/silo-react" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    silo: typeof silo;
  }
}
```

- **`Silo has no value named "x" in its storages`** at runtime: the key came
  from untyped data. Schema keys are literals validated at construction,
  non-empty and free of `:` and `.`; scope segments are validated in
  `scope()`, where they must be non-empty.

## Silo hooks must be used within a SiloProvider

A hook rendered above the provider, or in a tree that does not have one. In a
React Server Components application, check that the component calling the
hook is a client component: a hook cannot run in a server component even
though the package carries `"use client"`.

## Devtools shows a storage with nothing reached

The panel lists cached records created through `silo.value(key)` or `clear()`.
Mounting the panel creates none. Framework value-status hooks acquire their
keys and therefore also start hydration. Render the component that reads the key, or
call `silo.value(key).get()` in the console, and the record appears with its
`hydrate landed` row.
