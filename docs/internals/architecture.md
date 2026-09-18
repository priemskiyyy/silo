---
description: "How the Silo runtime is owned: adapter selection, keyspaces, migrations, value records, the write queue, diagnostics, disposal order and every invariant."
---

# Architecture

The runtime has these owners. Follow them in this order:

| Owner              | Responsibility                                                                     |
| ------------------ | ---------------------------------------------------------------------------------- |
| `Silo`             | Validates configuration, starts migrations, and coordinates resource disposal.     |
| `AcquiredStorages` | Selects adapters, exposes backends and native handles, and owns candidate cleanup. |
| `SiloValues`       | Resolves schema paths and shares one record per storage and physical key.          |
| `ValueRecord`      | Owns a key's value, status, hydration, and read validity.                          |
| `WriteQueue`       | Orders persistence requests and settles durability barriers.                       |
| `Migrations`       | Runs migration steps and admits value access after success.                        |
| `MigrationStore`   | Raw, namespace-relative access to every storage during a migration.                |
| `Keyspace`         | Composes logical addresses and translates physical keys for one storage.           |
| `ValueCodec`       | Encodes, decodes and checks expiry envelopes for one definition.                   |
| `Diagnostics`      | Lazy snapshots and events for inspectors, with no demand of its own.               |
| `Lifetime`         | Ordered, idempotent cleanup that rolls back a failed setup.                        |

`Backend` keeps the original adapter and an explicit `execution.mode`. It
executes callbacks inline in sync mode and on settlement in async mode. A mixed
candidate list selects async execution even when the chosen adapter is sync.
There are no lifted adapter objects. It does not decide which value wins.
`MigrationStore` owns raw namespace access and provides typed sync or async views.
It does not decide migration order or record versions.
`ValueCodec` keeps codec conversion and expiry envelopes together. It returns
decoded outcomes; `ValueRecord` decides whether they are current and commits them.
One codec belongs to each schema entry and is shared across that entry's scopes.
It holds no record state and reads the owning store's clock on each operation.

## Principles

1. Normalize persistence, not backends. Adapters translate; the core owns policy.
2. `get()` is synchronous on every adapter and returns the stored reference.
3. Reaching a value creates demand; the store status, flush and diagnostics do not.
4. One record per storage and physical key, shared by every handle.
5. Persistence is installed before anyone is notified.
6. A local write in flight beats a change from outside.
7. Adapter failures update status; write failures also reject `flush()`.
   Invalid configuration, encoding errors and updater errors throw to the caller.
8. Cleanup is deterministic, reverse ordered and idempotent.
9. Framework bindings hold no persistence logic.

## Startup and ownership

1. Construct `AcquiredStorages`. It owns all candidates before probing them.
   Each candidate must pass availability, native access, and synchronous observer
   setup. Failure tries the next candidate, including the final one. If none works,
   an aggregate error preserves the causes. Observers start muted; failed setup
   callbacks never become active. Release unused candidates and register disposal.
2. Resolve each storage's keyspace from its namespace override, selected adapter,
   and the store namespace, then validate storage names and schema keys.
3. Construct migrations and the value registry, registering their cleanup.
4. Connect acquired observers to the value registry, then start migrations.

Setup failures roll back resources in reverse order. Individually released
candidates leave the lifetime's pending collection and are not disposed again,
including when their cleanup throws. A
candidate shared across storage lists stays alive if selected anywhere. Storage
name dictionaries preserve own keys such as `__proto__`.

Logical addresses are `${namespace}:${...segments}:${key}`. A storage may translate
them through `keys.encode`, with `keys.decode` reversing that translation; the
core validates the round trip before using a physical key. Migration metadata
uses the same mapping. Scope membership uses record identity rather than a
physical prefix. The root
store and scope handles share the registry. Records live until explicit scope release or store disposal. There is no automatic
eviction or reference counting; applications release scopes when their consumers
finish using them. `release()` includes descendants, waits for all matching writes
to become durable, and leaves records intact if persistence fails. It rechecks
after each barrier so writes and records added while waiting are included. Physical addresses that equal the migration
version key are rejected, including scoped addresses in an empty namespace.

## Value commits

A record holds one `ValueStore<{ value, status }>`. The public value and status
observables are projections of that same snapshot. Both getters see the entire
commit before either kind of listener runs. Each projection uses `Object.is` to
notify only when its own selected value changes. Payload-free statuses are shared
constants.

`ValueStore` snapshots its listener collection for each notification pass. Removed
listeners are skipped, new listeners wait for another change, and a reentrant
update supersedes the older pass. Listener failures are reported separately and
do not stop other subscribers. Disposal silences the rest of an active pass.
The listener collection is allocated on the first subscription and released when
the last subscriber leaves.

## Hydration and external reads

Acquiring a value creates its record and starts hydration immediately. Repeated
acquisitions return the same handle and do not duplicate the initial read.
Observing adapter changes never creates records; status observation and flush do
not create demand either.

Each record registers once for migration admission and retains its outcome.
Pending admissions are cancellable; releasing a record removes it from the
migration owner without waiting for migration completion.
Pending reloads replace the read reservation; admission opens only the current
read. Each reservation contains its source and the current revision. Its result can commit only while the
reservation and revision are still current. A local mutation invalidates the
reservation and supersedes hydration. Reads do not begin while a local write is
pending or in flight, because such a read could capture stale storage data and
return after the write has finished.

Inbound data is decoded once, then kept by reference:

| Result                 | Initial hydration                                  | External report                       |
| ---------------------- | -------------------------------------------------- | ------------------------------------- |
| Absent                 | Fallback and ready status                          | Fallback and ready status             |
| Valid                  | Decoded value and ready status                     | Decoded value and ready status        |
| Expired                | Removal through the write queue                    | Removal through the write queue       |
| Invalid or failed read | Fallback and hydrate error; retain stored raw data | Ignore; preserve the current snapshot |

A rejected keyed external report does not cancel initial hydration. An accepted
external change invalidates older reads and is acknowledged as already durable.
External changes are ignored during local writes or before migration admission.
A coarse `{ key: null }` event reloads a snapshot of the existing records.

## Local writes

`set` and `remove` follow this sequence:

1. Encode the value. Expiring keys use `{ value, expires: { at } }`; relative
   `expires.in` becomes `now() + in`, while `expires.at` stays fixed.
2. Take the next record revision and invalidate older reads.
3. Submit the persistence request to the queue, before any notification.
4. Commit value and status together and settle hydration.

A synchronous adapter failure is included in that commit. An asynchronous failure
can update status only while the write's record revision remains current. Failed
writes retain their optimistic value. Encoding failures reach the caller; adapter
failures are reported through status and flush.

Installing persistence before notifying is essential. If a listener writes B
while receiving A, B takes a newer revision and replaces any pending A. The outer
frame cannot overwrite B after that listener returns.

## Queue and durability

The queue is paused until migration admission, ready after admission, and closed
after migration failure or disposal. It has one in-flight operation and one
latest-wins pending operation. It does not know about codecs, snapshots, hydration,
or migration promises.
Operation slots are allocated on the first write and released when idle. Barrier
collections exist only while flushes are waiting. Generation counters remain on
the queue so external acknowledgements and diagnostics keep the same semantics.

Every accepted operation takes a generation. `flush()` captures that generation
and resolves when the durable watermark reaches it. A later successful write can
satisfy a barrier for a coalesced operation. Failure rejects barriers up to the
failed generation, but only the latest generation may report a value error.
There is no automatic retry.

Store and scope barriers visit existing records and capture only dirty queues.
Already-durable records add no per-record promises. A later write to a clean
record does not extend an earlier flush.

A queue that has closed cannot restart. Late operation callbacks are ignored,
pending work is discarded, and outstanding barriers reject immediately.

## Migrations

All synchronous candidates give synchronous migration operations. Any async
candidate selects async execution for that storage. If any storage executes
asynchronously, migration access is async across every storage. The selected
adapters themselves are never wrapped or replaced.

`Migrations` reads the stored version and creates its store view once, then runs
steps in version order in an explicit sync or async loop. When the default
storage is synchronous, the version is read in the constructor's frame even on
a mixed set; if no declared step is above it, admission opens at once and every
synchronous storage keeps its first frame, otherwise the chain runs
asynchronously. Each successful step is
followed by its version write
in the default storage. A failure leaves the last completed version intact and
keeps value admission closed. Both synchronous and asynchronous execution report
operation failures through status and `ready()`; invalid migration declarations
throw during construction.

`MigrationStore` prefixes raw keys and supports keys absent from the current
schema. Its sync and async views share naming and lifecycle checks while retaining
their different return types. A sync view narrows its adapter by mode where it is
acquired; it does not refine the entire backend registry with a type predicate.
Copy and move preserve the original raw value;
moving a key onto itself does not delete it, even through another storage name
backed by the same adapter.

Disposal prevents new migration operations, later steps, and version writes. It
cannot cancel user code or adapter operations already running. Concurrent stores
are not locked, so migration callbacks must tolerate another context starting
from the same version.

## Disposal

`Silo.dispose()` is synchronous and idempotent. Reverse cleanup stops observation,
closes records, stops migrations, and releases adapters. No new record or clear is
accepted afterward; existing handles keep their last snapshot and ignore writes.

Unfinished hydration, flush barriers, and migration readiness reject on disposal.
An operation already sent to an adapter may still complete. Call `await
silo.flush()` before disposal when the last pending write must persist.

Disposed registries clear their maps. Records detach persistence resources and
migration admission callbacks; existing handles retain only their inactive
state. Hydration promises are allocated on demand. Internal record, codec, and
queue methods share prototypes; methods exposed as callbacks remain bound.

Diagnostics reuses unchanged record summaries and builds a fresh records array
only after a change. Event metadata and context are constructed only while an
event listener exists; snapshot invalidation remains independent of event
observation. Disposal emits one final event and snapshot notification,
then removes listeners and the snapshot reader. Its final snapshot has no records.
See [memory ownership](memory.md) for the benchmark and collection checks.

## Type audit

| Area                              | Decision                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiloScope`                       | Derive its methods with `Pick<Silo<...>, ...>` so signatures cannot drift.                                                                               |
| `InferValue`                      | Derive the read type from `ReturnType<decode>` and `fallback`.                                                                                           |
| Async migration operations        | Derive parameters and promised results from `SyncMigrationStore`; keep storage selection synchronous.                                                    |
| `MigrationFor`                    | Derive the callback from `SiloOptions`, where candidate modes determine migration types.                                                                 |
| Record lookup                     | Bind keys and values to the registry's schema; remove the caller-selected return type.                                                                   |
| Backend and admission             | Use the class and method types; remove the duplicated backend shape and `Admit` alias.                                                                   |
| Queue operations and barriers     | Derive accepted operation shape and deferred settlement types.                                                                                           |
| Lifecycle state                   | Record admission retains success or failure in a state union; hydration completion is derived from value status.                                         |
| Class fields                      | Infer constructor-assigned private fields when annotations only repeat the assignment.                                                                   |
| Status errors                     | Restrict store errors to migration and value errors to hydration or writes.                                                                              |
| Protocols and state unions        | Retain explicit codec, observable, value, expiry, inbound, queue-state, and storage contracts. These specify behavior rather than repeat implementation. |
| Schema mapping                    | Retain `Declarations`, `KeyOf`, `DefinitionOf`, `InferSchema`, and `NativeOf`: they express relationships that runtime inference cannot recover.         |
| Public mock and conformance types | Retain the supported testing contracts independently of their implementation.                                                                            |

The heterogeneous record map needs one local overload bridge. Its callers resolve
the value type from a schema key; they cannot request an unrelated type. Migration
callback inputs are narrowed using the execution mode established by
`SiloOptions`. Public return annotations keep internal classes out of emitted
declarations.

Native handles use one explicit assertion in `AcquiredStorages`, where runtime
enumeration loses the name-to-handle relationship. Selection constructs every
entry from that storage's chosen adapter; the public `NativeOf<TStorages>` type
retains each storage's candidate union.

## Regression coverage

`ValueRecord.test.ts` covers atomic status/value notifications, reentrant recovery,
stale reloads, invalid external data during hydration, admission success and
failure, and disposal during a notification. `WriteQueue.test.ts` covers coalescing, failure ownership, admission,
and closing barriers. `Silo.lifecycle.test.ts` covers setup rollback, shared
candidates, moves between aliases, rejected synchronous migrations, post-dispose
access, and migration cancellation. `ValueStore.test.ts` covers synchronous and
asynchronous subscriber failures, including projected subscriptions.

[Hydration and flush](../hydration-and-flush.md) describes the consumer contract;
[writing an adapter](../writing-an-adapter.md) describes the storage boundary.
