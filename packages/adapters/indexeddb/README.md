<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-indexeddb

[IndexedDB](https://developer.mozilla.org/docs/Web/API/IndexedDB_API) adapter for [silo](../../core): asynchronous persistence of structured clones, one transaction per operation, with cross-tab updates.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-indexeddb @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { draft: value<{ body: string; savedAt: Date }>() },
    },
  },
});

const draft = silo.value("draft");

await draft.hydrated();
draft.set({ body: "hello", savedAt: new Date() });
await draft.flush();
```

## Options

| Option      | Default            | Meaning                                                                                                     |
| ----------- | ------------------ | ----------------------------------------------------------------------------------------------------------- |
| `name`      | `"silo"`           | Database to open, also what `native.name` reports.                                                          |
| `store`     | `"values"`         | Object store to keep values in, created on first open.                                                      |
| `version`   | none               | Version to request. Omitted, the database opens at whatever version it already has.                         |
| `sharing`   | `"cross-tab"`      | Announce every write to the other tabs on this origin and observe theirs. `"single-tab"` removes `observe`. |
| `available` | `indexedDB` exists | Replaces the probe.                                                                                         |

## Behavior

- Values are stored as structured clones, so a `Date`, a `Map`, a `Set` or an `ArrayBuffer` comes back as itself. The browser suite tests `Blob` on Chromium and Firefox and skips that case on WebKit. Test binary data on your target browser versions. A value the clone refuses fails the write, which the core reports on the value's status.
- Each operation opens its own transaction and awaits only IndexedDB events. A write resolves when its transaction completes, so `flush()` means committed.
- The database opens on the first read, write or observer, never in the factory. Without `version` it opens at whatever version exists, so another tab's upgrade cannot lock this one out, and the adapter closes its own connection on `versionchange`. A database that already exists without the object store needs its own `name`, or a `version` above the current one so the upgrade creates it.
- `observe` is an announcement over a `BroadcastChannel` named `silo:indexeddb:<name>:<store>`: it hears what another silo adapter on the same database committed, never a write from devtools or another library, and never its own. `sharing: "single-tab"` removes `observe` entirely.
- `keys` lists every string key the store holds. `available()` is whether `indexedDB` exists, unless `available` is given a probe of its own; a browser that refuses to open it reports through the value's status.
- `native` is `{ name, version, database() }`. `await silo.native.default.database()` reaches the live `IDBDatabase`, reopening it if the browser closed it; use it for the call, do not store it.
- `dispose()` closes the channel and the connection, including one still opening.

## License

[MIT](LICENSE)
