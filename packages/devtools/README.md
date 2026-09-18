<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-devtools

Inspect the storages, cached records, migration state and event timeline of any
Silo store. The inspector is framework-independent and renders inside a shadow
root; the React wrapper reads the store from its provider.

```sh
pnpm add -D @priemskiyyy/silo-devtools
```

```tsx
import { SiloProvider } from "@priemskiyyy/silo-react";
import { SiloDevtools } from "@priemskiyyy/silo-devtools/react";

<SiloProvider silo={silo}>
  <App />
  {import.meta.env.DEV ? <SiloDevtools initialIsOpen /> : null}
</SiloProvider>;
```

Without a framework, construct the class from the package root and mount it
into any element:

```ts
import { SiloDevtools } from "@priemskiyyy/silo-devtools";

const devtools = new SiloDevtools({ silo });
devtools.mount(document.body.appendChild(document.createElement("div")));
```

| Option          | Default | Meaning                                                                       |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `silo`          |         | The store to inspect. The React wrapper takes it from the provider.           |
| `initialIsOpen` | `false` | Opens the panel on the first visit. Later visits restore the last open state. |
| `maxEvents`     | `200`   | Events kept in memory, clamped to 1 to 1000.                                  |

The class exposes `mount(element)`, `unmount()`, `setSilo(silo)` for an
application that rebuilds its store, and `setMaxEvents(count)`. Mounting twice
throws; recorded events survive an unmount and reappear on the next mount.

## What it shows

The header carries the store status and the migration version. The sidebar
lists every storage with the adapter that won and its mode, amber when that is
the memory fallback, and under each the records the application reached, with
scope, status and write counters. Selecting a record filters the timeline to
it plus migration and store events, and opens its detail: the physical key, a
bounded snapshot with a copy button, a JSON field to set a new value, and a
remove button. Both actions go through the store's own API, so listeners and
adapters see them like any application write.

Timeline rows show the local time, the event type, the storage, the key and a
summary, coloured by kind, with chips that filter one kind at a time and a
search box for everything else. Expanding a row shows the full context with a
copy button. The launcher turns red when an error arrives while the panel is
closed.

Recording runs while mounted, also while collapsed. Pause and Clear affect only
the inspector. Values stay hidden until "Show values" is ticked, and property
names containing `token`, `authorization`, `password`, `secret` or `cookie` are
redacted always. Contexts are copied into bounded plain data when recorded, so
history retains no store objects. The panel docks to the bottom or the right
edge and resizes by dragging its edge or with the arrow keys; the open state,
dock position and size persist in `localStorage`.

Devtools never reads a value the application has not reached. The panel is
built on `silo.diagnostics`, which any custom integration can read as well.

## License

[MIT](LICENSE)
