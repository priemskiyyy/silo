<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-cookie

Cookie adapter for [silo](../../core): synchronous, JSON encoded persistence in `document.cookie`, for the few values a server must see on every request, such as a theme or a locale. The cookie name is the physical key and the value its JSON, both URI encoded.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cookie @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { cookie } from "@priemskiyyy/silo-cookie";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [
        cookie({ maxAge: 60 * 60 * 24 * 365, sameSite: "lax" }),
        memory(),
      ],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

silo.value("theme").set("dark");
```

## Options

| Option      | Default               | Meaning                                                                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `path`      | `"/"`                 | So one key is one cookie for the whole site.                                                                               |
| `domain`    | none                  | Written as given.                                                                                                          |
| `secure`    | `false`               | Adds the `secure` attribute.                                                                                               |
| `sameSite`  | none                  | `"strict"`, `"lax"` or `"none"`.                                                                                           |
| `maxAge`    | none                  | Lifetime in seconds. Omitted, the cookie lasts the session.                                                                |
| `namespace` | `"visible"`           | Whether cookie names carry the store's namespace.                                                                          |
| `available` | the document resolves | Replaces the probe. No `document.cookie`, or cookies disabled, reads as absent.                                            |
| `format`    | `JSON`                | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- `path` defaults to `/`, so a key is one cookie for the whole site rather than one per directory the page happened to be on. A removal carries the same `path` and `domain` as the write.
- Without `maxAge` the cookie lasts the session. `maxAge` is in seconds.
- A cookie holds about 4KB, and every cookie travels to the server with every request. Keep values small and few.
- A write the browser drops in silence, over the size limit, `secure` on plain HTTP, or on a path the page is not under, is reported as a failed write, so the value's status says so instead of a reload losing it.
- Values are JSON text, URI encoded. Pass `format: superjson` (or `devalue`, anything with `stringify` and `parse`) for values JSON cannot spell; changing the format over existing data is a migration. `available` overrides the platform probe, so a candidate list can be gated by a consent flag.
- `namespace` is `"visible"` by default: cookie names carry the store's namespace, `silo%3Atheme`, because the jar is shared with every other script on the site. `namespace: "hidden"` drops it for an application that owns its jar, and a storage's own `namespace` overrides both.
- Nothing is observed: another tab's cookie writes are seen on the next reload, not live.
- `keys()` lists every cookie the page can see, third party ones included. The core only reads its own namespace.
- On a server the adapter constructs cold: `native` is `null`, `available()` is `false`, reads fall back, and a write throws an error naming the adapter.

## License

[MIT](LICENSE)
