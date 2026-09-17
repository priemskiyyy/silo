<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-chrome-storage

`chrome.storage` adapter for [silo](../../core): asynchronous persistence in one storage area of a browser extension, with changes made in other extension contexts observed through the area's `onChanged`. The area is handed over, so the same adapter serves `local`, `sync` and `session`.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-chrome-storage @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { chromeStorage } from "@priemskiyyy/silo-chrome-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [chromeStorage({ area: chrome.storage.local }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

await silo.value("theme").hydrated();
```

## Options

| Option      | Default      | Meaning                                                                                    |
| ----------- | ------------ | ------------------------------------------------------------------------------------------ |
| `area`      | required     | `chrome.storage.local`, `sync` or `session`. Firefox's `browser.storage` areas fit too.    |
| `available` | `() => true` | Replaces the probe, so a candidate list can be gated by application state at construction. |

## Behavior

- Pass `chrome.storage.local`, `chrome.storage.sync` or `chrome.storage.session`. `native` is that area. Only the members the adapter uses are typed, so the extension types are not a dependency and Firefox's `browser.storage` fits too.
- Values pass through untouched. The platform serializes them itself, so store what `chrome.storage` accepts: JSON shaped data.
- `sync` has a quota per item and per area, and a limit on writes per minute and per hour. A refused write reaches the value's status.
- Every context of the extension, the adapter's own writes included, reports through `onChanged`, one report per key. The core tolerates its own echo, and a removal reports the key as absent.
- `dispose` releases every observer the adapter registered. It never clears the area.
- `available()` is `true` unless `available` is given a probe of the application's own, so a candidate list can be gated at construction.

## License

[MIT](LICENSE)
