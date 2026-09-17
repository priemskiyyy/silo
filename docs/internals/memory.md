---
description: "Control cached record lifetime with explicit scope release, understand diagnostic costs, and reproduce Silo's memory measurements."
---

# Memory and record lifetime

Silo caches one record per storage and physical key. Repeated reads and scope
aliases reuse that record. Visiting new keys grows the cache; unsubscribing alone
does not evict records.

Release a scope when its consumers have finished using it:

```ts
await silo.scope(`documents:${documentId}`).release();
```

Release waits for accepted writes, includes descendants, and leaves persisted
data intact. Existing value handles become inactive and retain their last
snapshot. Acquiring the same key again creates a fresh record and hydrates it from
storage. The scope handle itself remains reusable. See [Scopes](../scopes.md) for
failure and lifecycle behavior.

`await silo.release()` releases all cached records while keeping the store alive.
`silo.dispose()` closes the entire store, clears its record registry and diagnostic
listeners, and detaches records from their former owner. Dispose does not wait for
writes: use `await silo.flush()` first when durability is required.

## Measurements

These local measurements use Node v24.16.0 with explicit garbage collection and a
synchronous adapter that retains no data. Each distinct scope acquires one numeric
value with fallback `0`. The results isolate core record overhead; they exclude
real payloads, framework subscriptions, and adapter memory. They are not browser
or production latency guarantees.

| Cached records | Original   | After lifecycle cleanup | After lazy allocations |
| -------------- | ---------- | ----------------------- | ---------------------- |
| 10,000         | 44.08 MiB  | 24.56 MiB               | 21.74 MiB              |
| 50,000         | 219.68 MiB | 122.02 MiB              | 107.90 MiB             |

The current overhead is approximately 2.2 KiB per record. Lazy allocations save
another 12% over the lifecycle cleanup, for a total reduction of about 51%.
Reacquiring every key added approximately zero retained heap.

The improvement depends on usage. Writing once to each of 50,000 records used
107.92 MiB, down from 122.03 MiB. With one core subscription per record, usage was
124.31 MiB, down from 131.18 MiB, a 5% reduction. These subscriptions add no
framework state. That is the total for 50,000 records with one subscription each,
approximately 2.5 KiB per record, not the memory consumed by a single value.

Before the cleanup, holding a disposed 10,000-record Silo retained 52.19 MiB.
Keeping just one old value handle after dropping Silo retained 51.87 MiB in a
separate run. After the cleanup, disposal retained approximately 0.09 MiB with
Silo and one old handle still referenced. Releasing 50,000 records while keeping
Silo alive retained approximately 0.11 MiB above baseline.

The reductions come from shared prototype methods for internal record, codec and
queue operations, hydration promises created only on demand, cleared registries,
cancellable migration admissions, and detached references to runtime resources.
Public value callbacks remain bound and safe to pass directly to consumers.
Codecs are shared per schema entry. Listener collections, operation slots, and
flush-barrier arrays are allocated only when needed and dropped when empty;
diagnostic counters remain available throughout the record's lifetime.

## Diagnostics

Diagnostics remain lazy. Event metadata and context are constructed only while
an event listener exists. Snapshot observation works independently of event
observation. Core retains no event history, and snapshots reference values
instead of copying their payloads. Unchanged record summaries are reused
between snapshots; refreshing a snapshot still traverses every cached record and
allocates a new array.

At 50,000 records, the first snapshot took 8.04 ms and added 8.02 MiB. Refreshing
after one changed record took 1.68 ms. These costs are absent when nobody requests
a snapshot. Disposal emits a final event and notification, leaves an empty record
list, and clears diagnostic listeners.

An application can still retain memory through old handles, snapshots, event
history, or its own data. An inactive handle intentionally keeps its last value
and status. Adapter operations already running cannot be cancelled by core and
may retain their callbacks until they settle. Explicit release controls the
cache lifetime; it does not impose an automatic memory limit.

## Temporary allocations

Store-wide flushes skip already-durable records. In two local comparisons,
flushing 50,000 clean records created 5 promises instead of 100,005. Median time
fell from 4.28 to 4.65 ms to 1.25 to 2.10 ms. Flush still visits the cached records and
waits for all writes captured when it is called; later writes do not extend it.

These changes reduce temporary allocations. Retained overhead stayed at
107.89 MiB for 50,000 records. Write timings with and without diagnostic event
listeners varied between runs, so they do not establish a fixed speedup.

## Reproduce

```sh
pnpm benchmark:memory 10000
pnpm benchmark:memory 50000
pnpm benchmark:memory 50000 release
pnpm benchmark:memory 50000 dispose write
pnpm benchmark:memory 50000 dispose subscribe
```

The script warms the runtime, measures live heap after GC, reuses the same keys,
measures diagnostics, then performs cleanup while retaining Silo and one old
value handle. It also measures dropping each remaining reference.
The optional workload argument writes once or subscribes once per record before
the live-heap measurement. The default workload only reads.

`pnpm benchmark:runtime 50000 500000` measures clean flushes over 50,000 records
and batches of 500,000 writes, with and without diagnostic event listeners.
It reports median timings after warmup, counts promises in a separate untimed
flush, and checks event counts without retaining event history.

`pnpm check` builds the packages and runs `pnpm test:memory`. The memory checks use
`WeakRef` and explicit GC to verify collection after disposal, release, cancelled
reads and writes, pending migrations, and closed diagnostics. They assert
reachability rather than a heap-size threshold.
