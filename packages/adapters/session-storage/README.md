<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-session-storage

Persist [Silo](../../core) values in browser sessionStorage for the current tab.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-session-storage @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { sessionStorage as sessionStorageAdapter } from "@priemskiyyy/silo-session-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [sessionStorageAdapter(), memory()],
      schema: { step: value({ fallback: 0 }) },
    },
  },
});

silo.value("step").set(2);
silo.value("step").get(); // 2, read synchronously, and gone when the tab closes
```

The export is called `sessionStorage`, which shadows the DOM global inside the importing module. Alias it whenever that module also reaches for the platform directly.

## Options

| Option      | Default               | Meaning                                                                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `available` | the platform resolves | Replaces the probe. Blocked site data and a server read as absent, so the next candidate is chosen.                        |
| `format`    | `JSON`                | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- A session area survives a reload and a same-tab navigation, is copied into a duplicated tab, and is gone when the tab closes. Two tabs share nothing.
- Values are JSON text: a `Date` reads back as a string, `undefined` is a removal, and a stored string that is not JSON throws on read, which the core reports as a hydrate error and leaves in place for `set` to overwrite. Pass `format: superjson` (or `devalue`, anything with `stringify` and `parse`) for values JSON cannot preserve; changing the format over existing data is a migration.
- `available` overrides the platform probe, so a candidate list can be gated by application state at construction, such as a consent flag.
- A `QuotaExceededError` propagates, and the core reports it on the value's status as a write error.
- `observe` is implemented and almost never fires: the `storage` event never fires in the tab that wrote, and only a same-origin iframe shares the session. It is filtered by storage area, and `{ key: null }` is a clear.
- `keys` lists every key the area holds. `available()` resolves the platform, so blocked site data or a server reads as unavailable and the next candidate is chosen.
- On a server the adapter constructs cold: `native` is `null`, reads fall back, `observe` is a no-op, and a write throws an error naming the adapter.

## License

[MIT](LICENSE)
