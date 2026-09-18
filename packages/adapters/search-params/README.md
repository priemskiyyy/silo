<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-search-params

URL adapter for [silo](../../core): every key is one parameter of the page's query string, or of its fragment, so a value is a shareable link and survives a reload. Writes go through `history.replaceState`, so nothing navigates, and back or forward is observed.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-search-params @priemskiyyy/silo-memory
```

## Create a silo

Use it as a named storage next to a durable default:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    url: {
      adapters: [searchParams(), memory()],
      schema: { filter: value({ schema: FilterSchema, fallback: "all" }) },
    },
  },
});

silo.value("url.filter").set("open"); // the address bar now reads ?filter=%22open%22
```

## Options

| Option      | Default               | Meaning                                                                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `hash`      | `false`               | Keep the parameters in the fragment, which never reaches a server log.                                                     |
| `sharing`   | `"single-tab"`        | `"cross-tab"` announces writes to the other tabs on this path over a `BroadcastChannel`, and writes theirs into this URL.  |
| `namespace` | `"hidden"`            | Whether parameter names carry the store's namespace.                                                                       |
| `available` | the location resolves | Replaces the probe. No `location`, or no `history.replaceState`, reads as absent.                                          |
| `format`    | `JSON`                | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Keep it a named storage. Migrations are versioned by the record in the default storage, and a fresh or shared link carries no version, so a URL storage as `default` would run every migration on every visit.
- A link written by an older release is not migrated either. URL keys are untrusted input: give each one a `schema` and a `fallback`, and a parameter that does not validate reads as the fallback.
- Values are JSON, so a string is quoted in the URL. `undefined` removes the parameter, and a parameter this adapter did not write fails to parse, which the core reports as a hydrate error. Pass `format` (anything with `stringify` and `parse`) to spell values differently; changing it over existing links is a migration. `available` overrides the platform probe.
- `namespace` is `"hidden"` by default, so the link reads `?filter=%22open%22` rather than `?silo%3Afilter=%22open%22`. `namespace: "visible"` keeps the store's keys apart from other parameters on the page, and a storage's own `namespace` overrides both.
- `searchParams({ hash: true })` keeps the parameters in the fragment, which never reaches a server log. Parameters this adapter did not write, and the other part of the URL, are left alone.
- `searchParams({ sharing: "cross-tab" })` makes the address bars of every tab on this path converge: a write here is announced over a `BroadcastChannel` named by the path, and each other tab writes it into its own URL before reporting it, so a reload there reads it. `"single-tab"` is the default, because a URL is one tab's by design. A tab on another path is never reached, and the query and the fragment use separate channels.
- `replaceState` only: a write does not add a history entry. Back and forward report every key at once through `popstate`, or `hashchange` for the fragment.
- Browsers and servers cap a URL at about 2000 characters. Keep values small.
- On a server the adapter constructs cold: `native` is `null`, `available()` is `false`, reads fall back, and a write throws an error naming the adapter.

## License

[MIT](LICENSE)
