---
description: "Install the Silo browser devtools to inspect storages, cached records, migration state and the event timeline, or build an inspector on the diagnostics API."
---

# Devtools

`@priemskiyyy/silo-devtools` shows every storage of a store with the adapter
that won its list, the records the application reached, the migration version,
and a timeline of what the runtime did to each key. The inspector is
framework-independent and renders inside a shadow root, so it looks and behaves
the same in React, Vue, Solid, Svelte or plain TypeScript.

```sh
pnpm add -D @priemskiyyy/silo-devtools
```

Listing records reads `silo.diagnostics` without hydrating values. The inspector
holds the selected Silo while attached and keeps a bounded event history. Its
Set and Remove controls explicitly write through the core API.

## Mount it

The React wrapper reads the store from the nearest `SiloProvider` and mounts
the inspector after hydration. Everywhere else, the class mounts into any
element. Use your bundler's development flag; the examples use Vite.

::: code-group

```tsx [React]
import { SiloProvider } from "@priemskiyyy/silo-react";
import { SiloDevtools } from "@priemskiyyy/silo-devtools/react";

<SiloProvider silo={silo}>
  <App />
  {import.meta.env.DEV ? <SiloDevtools /> : null}
</SiloProvider>;
```

```ts [Anywhere]
import { SiloDevtools } from "@priemskiyyy/silo-devtools";

const devtools = new SiloDevtools({ silo });
devtools.mount(document.body.appendChild(document.createElement("div")));
```

:::

Vue, Solid and Svelte wrappers are not shipped yet. Construct the class in the
framework's mounted hook, hand it the element the component rendered, and call
`unmount()` where the component is torn down.

| Option          | Type      | Default | Meaning                                                                             |
| --------------- | --------- | ------- | ----------------------------------------------------------------------------------- |
| `silo`          | `Silo`    |         | The store to inspect. The React wrapper takes it from the provider.                 |
| `initialIsOpen` | `boolean` | `false` | Opens the panel on the first visit. Later visits restore the last open state.       |
| `maxEvents`     | `number`  | `200`   | Events kept in memory, clamped to 1 to 1000. Older events are dropped from the top. |

The class adds four methods:

| Method                | Effect                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `mount(element)`      | Renders into `element` through a shadow root and starts recording. Mounting a second time throws.            |
| `unmount()`           | Removes the panel and stops recording. Recorded events survive and reappear on the next mount.               |
| `setSilo(silo)`       | Points the inspector at another store, for example after the application rebuilt it with different adapters. |
| `setMaxEvents(count)` | Changes the buffer size.                                                                                     |

The React wrapper calls `setSilo` and `setMaxEvents` for you when its provider
or its `maxEvents` prop changes.

## Inspect storages and records

The header shows the store status, `migrating`, `ready` or `error`, and the
migration version, `no migrations` without any, `reading, 2 declared` while the
chain has not read the stored version yet, then `v2 of 2`.

The sidebar lists every storage by name with the adapter that won its candidate
list and that adapter's mode. A storage that fell through to `memory()` is
marked amber: the application is running on the floor of its list, which is
usually a probe that failed, such as blocked site data or a missing platform.
Hovering a storage name shows its namespace.

Under each storage are the records the application reached, one per physical
key: the schema path, the scope it was reached under, its status, and how many
writes were accepted and how many became durable. A storage nothing has read
yet says so. Records are created by `silo.value(key)` or `clear()`. Framework
value and value-status hooks acquire keys too. Reading diagnostics creates no
records.

Selecting a record filters the timeline to that record plus migration and
store events, since a closed migration gate is usually why a record's own
events went nowhere. It also opens the record detail:

- The physical key, exactly as the adapter stores it.
- The current snapshot, bounded and copyable, hidden until "Show values" is
  ticked.
- A JSON field and a Set button that writes a new value through
  `silo.value(path).set`, and a Remove button that calls `remove()`.

Both actions go through the store's own API under the record's scope, so the
application's listeners, its codec and its adapter see them like any other
write.

## Read the timeline

Rows are newest first and show the local time, the event type, the storage,
the key, and a summary of the context: the outcome of a read, the kind of a
write, the version of a migration step, or the reason an outside change was
dropped. Hovering a timestamp shows the UTC value.

Rows are coloured by kind. The chips above them filter one kind at a time and
carry live counts; the search box matches everything else, including keys and
error messages.

| Kind        | Events                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| `ERROR`     | `write refused`, `migration failed`, and a `hydrate landed` whose outcome is `invalid` |
| `WRITE`     | `write accepted`, `write durable`                                                      |
| `READ`      | `record created`, `hydrate landed`                                                     |
| `OUTSIDE`   | `outside applied`, `outside dropped`                                                   |
| `MIGRATION` | `migration version`, `migration step`, `migration done`                                |
| `STORE`     | `scope released`, `store disposed`                                                     |

Expanding a row shows the full context with a copy button. When the panel is
collapsed, the launcher turns red the moment an error arrives and stays red
until the panel is opened.

## Record events

The timeline records while the inspector is mounted, also while collapsed.
Pause stops recording until pressed again; Clear forgets everything recorded.
Both affect only the inspector, never the store.

Values stay hidden until "Show values" is ticked: the record detail shows a
placeholder instead of the snapshot, and any `value`, `raw` or `data` property
of a context reads `[Values are hidden]`. A property whose name contains
`token`, `authorization`, `password`, `secret` or `cookie` reads `[Redacted]`
regardless of the switch. Silo's own event contexts carry no values, so the
switch guards what the application put in its snapshots, such as a session
token in a secure storage.

Contexts and snapshots are copied into bounded plain data when recorded:
strings are cut at two thousand characters, objects at fifty properties and six
levels, and getters never run. History retains no store objects.

Under React `StrictMode`, development mounts the wrapper twice, so the first
milliseconds may show the inspector attach, detach and attach again. The
store is unaffected, because mounting the wrapper reads nothing from it.

## Arrange the panel

The panel docks to the bottom edge by default. The dock button in the header
moves it to the right edge, where it becomes a column. Drag the free edge to
resize it, or focus the edge and use the arrow keys. Escape closes the panel
and returns focus to the launcher. The open state, dock position and size are
stored in `localStorage` under `@priemskiyyy/silo-devtools`, so a reload
restores them; `initialIsOpen` applies only on the first visit.

## The diagnostics API

The panel is built on `silo.diagnostics`, which any custom integration can
read the same way. Observing it creates no demand: nothing is read from an
adapter, and events are only assembled while someone listens.

```ts
import type { SiloDiagnosticEvent } from "@priemskiyyy/silo";

const stop = silo.diagnostics.subscribe(() => {
  const { status, version, storages, records } = silo.diagnostics.get();
  render({ status, version, storages, records });
});

const stopEvents = silo.diagnostics.events.subscribe(
  (event: SiloDiagnosticEvent) => {
    console.debug(event.type, event.storage, event.key, event.context);
  },
);
```

`get()` answers a `SiloSnapshot`, computed lazily and cached until the next
change. Diagnostic snapshot notifications are batched once per microtask.
Value subscriptions and diagnostic event listeners run synchronously when
their changes are committed or emitted. Disposal of the store sends one final
notification, clears every listener, and leaves a stable snapshot with no
records.

| Snapshot field     | Meaning                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `status`           | The store's `SiloStatus`: `migrating`, `ready`, or `error` with the failed migration's cause.                   |
| `version.declared` | The highest migration key the store was constructed with, `0` without migrations.                               |
| `version.stored`   | The version record read from the default storage, or `null` until the migration chain has read it.              |
| `storages[]`       | Each storage's `name`, the `adapter` name that won, its `mode`, and the `namespace` its keys are composed with. |
| `records[]`        | Each cached record: `storage`, `path`, scope `segments`, `physicalKey`, `status`, `value`, and its `writes`.    |
| `records[].writes` | `accepted` and `durable` counts, and `inflight` while the adapter holds a write.                                |

Every event carries the same six fields:

| Event field | Meaning                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `source`    | `value` for a record's own events, `migration` for the chain, `store` for scope release and disposal.               |
| `type`      | One of the phrases below.                                                                                           |
| `storage`   | The storage name for `value` events, `null` otherwise.                                                              |
| `key`       | The physical key for `value` events, `null` otherwise.                                                              |
| `timestamp` | `Date.now()` when the event was emitted.                                                                            |
| `context`   | Event details, including outcomes, versions and error causes. Causes may contain arbitrary application or SDK data. |

| Type                | Source      | Context                                                                                         |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `record created`    | `value`     | `{ path, segments }` when a key is first reached.                                               |
| `hydrate landed`    | `value`     | `{ outcome }`, one of `absent`, `value`, `expired`, `invalid`, plus `cause` when invalid.       |
| `write accepted`    | `value`     | `{ kind, revision }`, where `kind` is `set` or `remove`.                                        |
| `write durable`     | `value`     | `{ generation }` when the adapter confirmed the write.                                          |
| `write refused`     | `value`     | `{ generation, cause }` when the adapter threw or rejected.                                     |
| `outside applied`   | `value`     | `{ outcome }` when a change from another tab or process replaced the snapshot.                  |
| `outside dropped`   | `value`     | `{ reason }` while a local write is in flight, or `{ cause }` when the change would not decode. |
| `migration version` | `migration` | `{ version }` once the stored version was read.                                                 |
| `migration step`    | `migration` | `{ version }` before a step runs.                                                               |
| `migration done`    | `migration` | `{ version }` when the chain finished.                                                          |
| `migration failed`  | `migration` | `{ cause }` when a step threw or rejected.                                                      |
| `scope released`    | `store`     | `{ segments }` after `release()` freed a scope's records.                                       |
| `store disposed`    | `store`     | `null`, the last event a store emits.                                                           |

The event types are plain strings rather than a union, so a custom integration
that switches on them should treat an unknown phrase as informational rather
than failing.

## Diagnose a value that reads its fallback

1. Find the storage in the sidebar. If it is amber, the intended adapter's
   probe failed and `memory()` won; the data is in the other backend, untouched.
2. Check the header. A store stuck in `migrating` or in `error` has not opened
   the gate, and no record below it has hydrated.
3. Select the record and read its `hydrate landed` row. `absent` means the
   physical key holds nothing under this namespace and scope; `expired` means
   the envelope's `expires.at` has passed; `invalid` means the raw value did not
   decode, and the cause is in the row.
4. Compare the physical key in the detail with what the backend holds. A
   different namespace, scope or storage composes a different key.
5. If the record shows `outside dropped`, another tab wrote while this one had
   a write in flight, and the local write won.

Redaction matches known property names and does not guarantee removal of every
sensitive value; inspect copied context before sharing it.
