---
description: "Silo's two barriers: hydrated() waits for a key's first read, flush() waits for durability against a watermark, and release() frees records safely."
---

# Hydration and flush

Reads are synchronous, so the only promises in Silo are barriers: points you
wait at, not values you fetch. There are two per key.

| Barrier      | Waits for                                                     | Rejects when                                      |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------- |
| `hydrated()` | The first read of this key to land, whatever its outcome.     | Disposal or scope release cancels the read.       |
| `flush()`    | Every mutation accepted before the call to reach the adapter. | A write fails or disposal interrupts the barrier. |

Neither creates a read. Reaching the key with `silo.value(key)` did that
already; the barriers only wait for what is in motion.

## hydrated

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { draft: value({ fallback: "" }) },
    },
  },
});

const draft = silo.value("draft");

await draft.hydrated();

draft.get(); // the persisted value, not the fallback
```

`hydrated()` **resolves**, it does not report an outcome. It resolves when the
first read has landed, including when that read failed: an adapter that threw
or a value that would not decode is a completed hydration whose result is an
error status. Check `status` for the outcome, not the promise.

It resolves early in two other cases, both deliberate:

- A `set()` or `remove()` issued before the read lands supersedes it. The read
  is abandoned, because the caller's value is newer than anything on disk, and
  `hydrated()` settles at once rather than waiting for a value nobody will
  use.
- On a synchronous storage hydration already happened inside
  `silo.value(key)`, so the promise is already settled when you receive it.

`silo.value(key)` starts hydration before returning the handle. Hydration is
reserved before the adapter is called, so repeated acquisitions and callers
awaiting the same key still produce exactly one read.

It rejects if disposal or [scope release](scopes.md#release) cancels a pending
read. For disposal the message is
`This Silo was disposed before "draft" finished hydrating.`; for a released
scope it starts with `This Silo scope was released`.

### Behind the migration gate

While `silo.status` is `migrating`, every read waits: the record is created,
`hydrated()` is pending, and the snapshot holds the fallback. The gate opens
when the chain finishes and every waiting read runs. When the default storage
is synchronous and no step is pending, the gate opens inside the constructor,
so a synchronous storage keeps its first frame even with migrations declared.
See [migrations](migrations.md).

## flush

`flush()` is the durability barrier. It captures the key's current revision
and resolves once the adapter has accepted at least that many.

```ts
draft.set("hello");
await draft.flush(); // now it is on the backend
```

On a synchronous storage the write has already happened by the time `set()`
returns, and `flush()` is an already resolved promise. It still belongs in
code that must be portable: the same call blocks on IndexedDB.

### Writes coalesce, barriers do not

A key has one write in flight and one pending slot, which is latest wins. A
write issued while another is in flight replaces whatever is waiting:

```text
set("a")   revision 1   write("a") starts
set("b")   revision 2   pending := b
set("c")   revision 3   pending := c        b is dropped, it never reaches the adapter
flush()                 target = 3
write("a") completes    durable = 1         pending c starts
write("c") completes    durable = 3         flush resolves
```

Three writes, two round trips, and the backend converges on the newest
value. This is why `flush()` is defined against a **watermark** rather than
against "my write finished": revision 2 was coalesced away and has no
completion of its own, and a barrier taken at that moment is satisfied by
revision 3, which superseded it. A barrier never hangs waiting for a write
that was dropped.

On a synchronous storage nothing coalesces: each `set()` reaches the backend
in its own frame. Coalescing is what an asynchronous storage buys, and it
means a slider or a text field can call `set` on every keystroke without
queueing a round trip per character.

### Failure

A failed write never throws out of `set()`. It lands on the status and
rejects the barriers waiting on that revision:

```ts
draft.set("hello");

try {
  await draft.flush();
} catch (error) {
  console.warn("not persisted", error);
}
```

`flush()` checks the watermark **before** the status, which gives it a
precise meaning after a failure: a flush with nothing newer accepted keeps
rejecting with the same error, every time you call it, rather than quietly
resolving. The moment a newer mutation is accepted, the error status is
cleared and the next `flush()` waits for that mutation instead.

Nothing retries automatically. The snapshot keeps the value you set, so a
retry is `set()` again, or a reconciliation against `get()`. See
[errors and recovery](errors-and-recovery.md) for what quota exhaustion and
blocked storage look like here.

### What flush does not do

- It does not wait for another tab. A change observed from outside is already
  durable when it arrives, and it moves the watermark with it.
- It does not confirm a read. Await `hydrated()` for that.
- It does not survive a store that was disposed while the write was pending:
  the barrier rejects, naming the key.

## When to await

- **Before navigation or unload**, when the last keystroke must survive. A
  synchronous storage needs nothing; an asynchronous one needs the barrier,
  and a `pagehide` handler is too late for IndexedDB.
- **In tests**, so an assertion against the adapter's own store reads what
  the application wrote. See [testing](testing.md).
- **Before `dispose()`**, for the same reason.

Do not await it in a render or an event handler for its own sake. The
snapshot is already what you set; the barrier only says when the backend
agrees.

## Store wide barriers

```ts
await silo.flush(); // every value this store has touched
await silo.clear(); // remove every schema key at this scope, then wait
await silo.ready(); // migrations are done
```

- `silo.flush()` is the same barrier across every record the store has
  created, so it waits for exactly the writes that were accepted before the
  call.
- `silo.clear()` removes every key the schema declares at that scope, across
  every storage, and returns a barrier over those removals. It is
  [schema driven](scopes.md), so a key written by an older schema at the same
  scope survives it.
- `silo.ready()` resolves when migrations have finished and rejects with the
  migration that failed. When every storage is synchronous, migrations run
  inside the constructor and it is already settled. See
  [migrations](migrations.md).

## Before disposing

`dispose()` is synchronous: it cannot wait. An operation already sent to the
adapter may still finish, but queued writes are discarded. Outstanding flush
barriers reject immediately; the disposed store cannot track durability
anymore.

```ts
await silo.flush();
silo.dispose();
```

That is the whole rule: flush first if the last write matters. Outstanding
`hydrated()`, `flush()`, and migration `ready()` promises reject on dispose,
and a `set()` after it is a silent no-op.

`await scope.release()` waits for durable writes, then frees cached records
without deleting stored data. Unlike `flush()`, it rechecks writes accepted
while waiting. On failure it rejects and keeps the records available for
recovery. The store stays usable; released value handles become inactive.
See [scopes](scopes.md#release).
