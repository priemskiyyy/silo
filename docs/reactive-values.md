---
description: "Silo values as external stores: get() returns the stored reference, decode runs once per inbound raw, set() is optimistic, and status is observed apart."
---

# Reactive values

A value handle provides the current value through `get()` and loading or error
state through `status.get()`. Subscribe to either independently; listeners read
the latest snapshot when notified.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

type User = { id: string; name: string };

const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
        user: value<User>(),
      },
    },
  },
});

const theme = silo.value("theme");

const stop = theme.subscribe(() => {
  console.log("theme is now", theme.get());
});

theme.set("dark"); // logs "theme is now dark"
stop();
```

`subscribe` returns its own unsubscribe and never calls the listener on
subscription: read `get()` once for the current value, then let the listener
tell you about the next one. Listeners take no arguments on purpose, so a
snapshot can never be delivered stale.

## The handle

| Member       | Does                                                                                      | Creates a read |
| ------------ | ----------------------------------------------------------------------------------------- | -------------- |
| `get()`      | Returns the current snapshot, synchronously, on every adapter.                            | no             |
| `subscribe`  | Registers a listener for the next change. Returns the unsubscribe.                        | no             |
| `set(value)` | Encodes, queues persistence, then commits the snapshot and status. Encoding errors throw. | no             |
| `remove()`   | Resets the snapshot to the fallback and queues the deletion.                              | no             |
| `status`     | An `ObservableValue<ValueStatus>` beside the snapshot.                                    | no             |
| `reload()`   | Reads storage again after pending writes; rejects on failure.                             | yes            |
| `hydrated()` | Resolves once the first read has completed. See [hydration](hydration-and-flush.md).      | no             |
| `flush()`    | Resolves once every accepted write reached the adapter.                                   | no             |

The read happens earlier than any of them: `silo.value(key)` creates the
record and starts its hydration in the same call. That is what demand means in
Silo. A handle you hold has already asked the adapter for its value, and
its getters do not read storage again. Subscriptions and pending barriers can
allocate additional state. `silo.status` and `silo.diagnostics` inspect the store
without acquiring records.

Handles are memoized per key per scope, so `silo.value("theme")` in two
places is the same object with the same subscribers.

## One notification per change

A mutation settles everything before it announces anything. `set()` encodes,
takes a revision, submits the write to the queue, and then commits the value and
the status together. The commit is the single notification. Two consequences
worth relying on:

- Inside a listener, `status.get()` already reflects this change.
- A listener that calls `set()` while being notified is ordered after the
  mutation that notified it, and persists after it. Reentrant writes cannot
  land out of order.

Changes from other sources arrive through the same path: a write in another
tab that the adapter [observes](external-observation.md), an
[expiry](ttl.md), a [hydration](hydration-and-flush.md) that completes. A local
write always wins over an external change that arrives while it is in flight.

A listener that throws does not break the notification. The error is rethrown
in a microtask, so it surfaces as an unhandled error, and every other
listener still runs. A listener that returns a rejected promise is reported
the same way. Catch inside your own listeners rather than relying on it.

## The identity rule

**`get()` returns the stored reference.** It is not a copy, not a fresh
decode, and not a new object per call:

```ts
const user = silo.value("user");

user.get() === user.get(); // true: the same object, not a fresh decode
```

Decoding runs **once per inbound value**: once when a value is hydrated, once
per change observed from outside. It never runs on a read. The fallback is
the definition's own reference, so an absent key also keeps one identity.

This is a correctness requirement, not an optimization. React's
`useSyncExternalStore` compares the snapshot it gets with the one it had
using `Object.is`. A `get()` that decoded on every call would hand back a new
object every time, React would conclude the store changed on every render,
and the component would rerender forever. The React binding is thin because
the core already guarantees this.

## Stored values are immutable

The other half of the same rule: what you get is what is stored, so mutating
it corrupts the snapshot and notifies nobody.

```ts
const current = user.get();

if (current !== undefined) {
  current.name = "grace"; // wrong: nothing is persisted, nothing is notified
}
```

Every reader now sees `"grace"`, no subscriber was told, and the backend
still holds the old name. The same applies to the value you pass in:
`set(next)` stores `next` by reference, so keeping a handle to it and mutating
it later has exactly the same effect.

Replace instead:

```ts
const rename = (name: string) => {
  const current = user.get();

  if (current === undefined) {
    return;
  }

  user.set({ ...current, name });
};
```

Re-setting the same object does not rescue it: snapshots are deduplicated
with `Object.is`, so the write happens and the notification does not. Only a
new reference notifies.

The memory adapter clones on the way in and out, so a mutation cannot reach
its `Map`, but the snapshot in front of it is still shared. Treat every
stored value as frozen, including arrays: `push` on a stored array is the
same bug.

## Status

```ts
type ValueStatus =
  | { state: "hydrating" }
  | { state: "ready" }
  | {
      state: "error";
      error: { phase: "hydrate" | "read" | "write"; cause: unknown };
    };
```

`value.status` is an `ObservableValue` with the same shape as the snapshot:
`get()` and `subscribe()`. It is deduplicated with `Object.is`, and the two
payload-free states are interned, so a run of writes that all succeed
notifies status subscribers once, not once per write.

```ts
const stopWatching = theme.status.subscribe(() => {
  const status = theme.status.get();

  if (status.state === "error") {
    console.warn(status.error.phase, status.error.cause);
  }
});
```

`error.phase` says which side failed. `hydrate` means the value could not be
read or decoded and the snapshot fell back; `write` means the snapshot is
what you set but the backend refused it.
[Errors and recovery](errors-and-recovery.md) is the full surface.

There is no `idle` state. Reaching a value starts its read, and on a
synchronous storage without a pending migration it settles before the handle
returns. The status is then `ready`, or `error` if hydration failed.

## In React

The binding maps each observable to one hook:

```tsx
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";

const Profile = () => {
  const status = useValueStatus("user");
  const [user, setUser] = useValue("user");

  if (status.state === "hydrating") {
    return <p>Loading</p>;
  }

  return (
    <button onClick={() => setUser({ id: "1", name: "grace" })}>
      {String(user)}
    </button>
  );
};
```

`useValue` subscribes to the snapshot, `useValueStatus` only to the status,
so a component that renders progress alone does not rerender when the value
changes. The setter accepts a value or an updater of the latest snapshot and
is stable while the handle is unchanged. Include it in dependency arrays so
an effect also follows a changed key or scope.

Nothing is registered here, so `user` is `unknown` in this snippet. Augment
`Register` once, as [getting started](getting-started.md) does, and it is
`User | undefined`. See [React](react.md).
