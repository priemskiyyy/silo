<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-local-storage

[localStorage](https://developer.mozilla.org/docs/Web/API/Window/localStorage) adapter for [silo](../../core): synchronous, JSON encoded persistence that survives a reload and reaches every tab on the origin.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorageAdapter(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

silo.value("theme").set("dark");
silo.value("theme").get(); // "dark", read synchronously
```

The export is called `localStorage`, which shadows the DOM global inside the importing module. Alias it whenever that module also reaches for the platform directly.

## Options

| Option      | Default               | Meaning                                                                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `available` | the platform resolves | Replaces the probe. Blocked site data and a server read as absent, so the next candidate is chosen.                        |
| `format`    | `JSON`                | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Values are JSON text: a `Date` reads back as a string, `undefined` is a removal, and a stored string that is not JSON throws on read, which the core reports as a hydrate error and leaves in place for `set` to overwrite. Pass `format: superjson` (or `devalue`, anything with `stringify` and `parse`) for values JSON cannot spell; changing the format over existing data is a migration.
- `available` overrides the platform probe, so a candidate list can be gated by application state at construction, such as a consent flag.
- A `QuotaExceededError` propagates, and the core reports it on the value's status as a write error. Browsers allot about 5MB per origin, shared with every other library.
- `observe` listens for the `storage` event, filtered by storage area so a `sessionStorage` write never masquerades as a local one. The event never fires in the tab that wrote, so there is no echo. `{ key: null }` is a clear.
- `keys` lists every key the area holds. `available()` resolves the platform, so blocked site data or a server reads as unavailable and the next candidate is chosen.
- On a server the adapter constructs cold: `native` is `null`, reads fall back, `observe` is a no-op, and a write throws an error naming the adapter.

## License

[MIT](LICENSE)
