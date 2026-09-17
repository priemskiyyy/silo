---
description: "Silo's failure surface: what throws, which failures become an error status with which phase, what rejects a barrier, and how to recover from each."
---

# Errors and recovery

A full quota, blocked storage, invalid stored data or a failed server request
appears on `status`. Failed writes also reject `flush()`. Encoding errors and
errors thrown by framework updater callbacks still reach their caller.

## The shape of an error

Every failure the store reports has the same shape, narrowed by where it
appears:

```ts
type SiloError = { phase: "migrate" | "hydrate" | "write"; cause: unknown };

type ValueStatus =
  | { state: "hydrating" }
  | { state: "ready" }
  | { state: "error"; error: SiloError & { phase: "hydrate" | "write" } };

type SiloStatus =
  | { state: "migrating" }
  | { state: "ready" }
  | { state: "error"; error: SiloError & { phase: "migrate" } };
```

`phase` says which side failed, `cause` is whatever was thrown or rejected
with. A value's status only ever carries `hydrate` or `write`; the store's
own status only ever carries `migrate`, so narrowing on `error.phase` is
exhaustive on each.

| Phase     | Where          | Cause                                                       | The snapshot then holds | Recovery                                                      |
| --------- | -------------- | ----------------------------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| `hydrate` | `value.status` | `adapter.get` threw or rejected                             | the fallback            | `set()` or `remove()`; a later read succeeds                  |
| `hydrate` | `value.status` | `decode` threw, including a validator rejecting stored data | the fallback            | `set()` or `remove()`, or fix the codec                       |
| `write`   | `value.status` | `adapter.set` or `adapter.remove` threw or rejected         | the value you set       | `set()` again, or reconcile against `get()`                   |
| `write`   | `value.status` | a migration failed, so the write was never allowed through  | the value you set       | fix the step, reload                                          |
| `migrate` | `silo.status`  | a migration step threw or rejected                          | every value: fallback   | fix the step, reload; the stored version resumes at that step |

Accepting a newer mutation clears a value's error. A read that succeeds
later does too.

```ts
const token = silo.value("token");
const status = token.status.get();

if (status.state === "error") {
  console.warn(status.error.phase, status.error.cause);
}
```

## What throws synchronously

Two groups, and they are both programmer errors or your own code.

**Your codec.** `encode` runs inside `set()`, before anything else, and its
throw is yours to catch:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        port: value<number>({
          codec: {
            encode: (value) => {
              if (!Number.isInteger(value)) {
                throw new Error("port must be an integer");
              }

              return value;
            },
            decode: (raw) => Number(raw),
          },
        }),
        token: value<string>(),
      },
    },
  },
});

silo.value("port").set(8080); // fine
// silo.value("port").set(1.5); // throws "port must be an integer"
```

An encoding error leaves the snapshot, revision and backend unchanged. A
framework setter also propagates an error thrown by its updater callback.

**Construction and lookup.** A namespace containing `:`, an empty schema key
or one containing `:` or `.`, a storage name containing `.`, a storages
object without `default`, an empty candidate list, an empty scope segment, a
migration keyed by anything but a positive integer, and a key that is not in
the schema all throw where you wrote them. In TypeScript the last one is a
compile error first.

## Hydrate errors keep the data

Two specifics worth knowing:

- **The unreadable raw value is kept, untouched.** It is not deleted, not
  quarantined, or rewritten. Keeping it allows inspection and migration. `set()` and `remove()` are the recovery path, and a
  [migration](migrations.md) is the planned one.
- **A decode failure arriving from outside keeps the last good snapshot.**
  If another tab writes something this tab cannot read, the value on screen
  stays. A worse answer is not an improvement over the current one.

A Standard Schema validator is a decoder like any other: a Zod schema that
rejects a hand-edited URL parameter reports `hydrate` with an error describing the validation issues as the
cause, and the key reads as its fallback. See
[schema and codecs](schema-and-codecs.md).

## What rejects a barrier

| Call               | Rejects with                                                                       |
| ------------------ | ---------------------------------------------------------------------------------- |
| `value.flush()`    | The write error, and again on every later call until a newer mutation is accepted. |
| `silo.flush()`     | The first write error among the values it covers.                                  |
| `silo.clear()`     | The same, for the removals it issued.                                              |
| `scope.release()`  | A write that failed while it waited; the records stay for recovery.                |
| `value.hydrated()` | Only disposal or scope release. A failed hydration still resolves.                 |
| `silo.ready()`     | The migration that failed.                                                         |

```ts
token.set("abc");

try {
  await token.flush();
} catch (error) {
  console.warn("not persisted", error);
}
```

Nothing retries by itself. The snapshot still holds what you set, so a retry
is another `set()`.

## Symptoms

| Symptom                                              | Phase     | What happened                                                | What to do                                                                       |
| ---------------------------------------------------- | --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Value reads its fallback on a device that had data   | `hydrate` | the raw would not decode, or the adapter threw               | check the cause; ship a migration or a lenient codec                             |
| Screen shows the new value, reload shows the old one | `write`   | the adapter refused the write: quota, blocked storage, a 5xx | watch the status and tell the user; retry with `set()`                           |
| Every value reads its fallback, nothing persists     | `migrate` | a migration step failed and closed the store                 | read `silo.status`, fix the step, reload                                         |
| `flush()` keeps rejecting                            | `write`   | nothing newer was accepted since the failure                 | intended; `set()` again clears it                                                |
| Nothing at all persists, no error anywhere           |           | the candidate list landed on `memory()`                      | check `silo.diagnostics.get().storages`; the probe of the first candidate failed |

## Quota exhaustion

`localStorage.setItem` throws `QuotaExceededError` synchronously when the
origin is out of space, which in a naive integration crashes the event
handler that called it. Here it is a write error: the snapshot keeps your
value, the status turns `error` with `phase: "write"`, and `flush()`
rejects.

That means **the screen and the disk disagree**, and nothing tells the user
unless you do. Watch the status of anything that must be durable:

```tsx
import { useValueStatus } from "@priemskiyyy/silo-react";

const SaveState = () => {
  const status = useValueStatus("draft");

  if (status.state === "error" && status.error.phase === "write") {
    return <p role="alert">Not saved. Storage is full or unavailable.</p>;
  }

  return null;
};
```

Browsers typically allow 5 MiB each for `localStorage` and `sessionStorage`
per origin. IndexedDB uses browser-specific quotas and is better suited to
large values. See [MDN's quota reference](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Blocked or unavailable storage

When a browser blocks site data, the `window.localStorage` **getter itself**
throws `SecurityError`. The browser adapters resolve the platform lazily
inside a try/catch and memoize the result, so this is not a crash on
import. It is a failed probe, and a candidate list is the recovery:

```ts
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const app = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value({ fallback: "light" }) },
    },
  },
});

if (app.native.default instanceof Map) {
  console.info("Running without persistence: values will not survive a reload");
}
```

`localStorage()` answers `available()` with whether the platform is there,
so the store lands on `memory()` and every read and write works for the
session. Without a fallback candidate the browser adapter is taken anyway:
reads answer `undefined`, `native` is `null`, and writes become `write`
errors. Both are deliberate; pick the one your application can explain.

`available` on every adapter can be replaced by a probe of your own, which
is how a consent banner, a private-mode flag, or a platform check decides
the list at construction. See [adapters](adapters.md).

IndexedDB fails differently. An open request blocked by another tab holding
an older version stays pending and completes by itself when that tab
closes, so the adapter logs a warning naming the database rather than
failing silently. Reads and writes behind it stay pending, and so does
`hydrated()`.

## A failed migration

A step that throws or rejects lands on `silo.status` as
`{ state: "error", error: { phase: "migrate", cause } }`, on both modes,
and `silo.ready()` rejects with the same cause. The store closes: every
value reached after that reads its fallback with a `hydrate` error carrying
the cause, and every write is refused with a `write` error carrying it. The
stored version stays at the last step that landed, so the next start resumes
there. See [migrations](migrations.md).

## The snapshot is not rolled back

A failed write **keeps the optimistic snapshot**. Silo does not revert to
the previous value. Rolling back needs a per revision history that the
runtime does not keep, and reverting under the user while a retry might
still succeed is its own bug.

So after a write failure, `get()` is what you set and the backend is what it
was before. Pick one of three answers:

1. **Report it.** Watch `status` and show that the change was not saved. The
   right default for a preference or a draft.
2. **Reconcile.** Await `flush()`, and on rejection set the value back to
   what your application considers the truth, or call `remove()`.
3. **Allow a session-only value.** If persistence is optional, keep the
   optimistic value and make that behavior clear in the application.

## Listeners that throw

A subscriber that throws does not break the notification: the error is
rethrown in a microtask, so it surfaces as an unhandled error, and every
other listener still runs. Do not rely on it. Catch inside your own
listeners.

## Dispose

`dispose()` rejects every outstanding `hydrated()` promise with
`This Silo was disposed before "<key>" finished hydrating.`, rejects a
pending `flush()` the same way, stops notifications, and refuses new
mutations silently. A `set()` after disposal is a no-op, not a throw, so
teardown order in a component tree cannot crash a page. `silo.flush()` and
`silo.clear()` after disposal reject with `This Silo was disposed.`.
Reaching a disposed adapter directly, past the store, throws an error naming
the adapter.

## Where the cause is recorded

Hydration, persistence, migration and rejected external updates emit diagnostic
events while a listener is attached. Their context includes the cause:
`hydrate landed` with outcome `invalid`, `write refused`, `migration failed`,
`outside dropped`. [Devtools](devtools.md) lists them per record, and
`silo.diagnostics.events` streams them to your own logger:

```ts
silo.diagnostics.events.subscribe((event) => {
  if (event.type === "write refused" || event.type === "migration failed") {
    report(event.type, event.key, event.context);
  }
});
```

## See also

- [Troubleshooting](troubleshooting.md) for symptoms and their causes.
- [Schema and codecs](schema-and-codecs.md) for the decode failure policy.
- [Hydration and flush](hydration-and-flush.md) for what each barrier waits
  on.
