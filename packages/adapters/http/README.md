<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-http

HTTP adapter for [silo](../../core): asynchronous persistence against a REST key-value resource over `fetch`, for the values that must follow the user from one device to the next. It speaks a contract of its own, four routes under one base URL, which your server implements; it does not talk to an arbitrary API.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-http @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { http } from "@priemskiyyy/silo-http";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

type Settings = { locale: string; digest: boolean };

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    remote: {
      adapters: [
        http({
          url: "https://api.example.com/kv",
          headers: () => ({ authorization: `Bearer ${session.token}` }),
        }),
        memory(),
      ],
      schema: { settings: value<Settings>() },
    },
  },
});

const settings = silo.value("remote.settings");

await settings.hydrated();
settings.set({ locale: "en", digest: true });
await settings.flush();
```

## Server contract

One resource per key under the base URL, where `{key}` is the physical key percent encoded, for example `silo%3Ausers%3A7%3Atheme`.

| Request                                                                            | Answer                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET {url}/{key}`                                                                  | `200` with the value as a JSON body, or `404` when the key is absent |
| `PUT {url}/{key}` with `Content-Type: application/json` and the JSON value as body | any `2xx`                                                            |
| `DELETE {url}/{key}`                                                               | any `2xx`, or `404` for a key that was not there                     |
| `GET {url}`                                                                        | `200` with a JSON array of the physical keys the server holds        |

Any other status fails the operation with an error naming the method, the resource and the status, which the core reports on the value's status as a hydrate or write error. A body that is not JSON fails the same way. A network failure from `fetch` propagates as it is.

## Options

| Option      | Default                | Meaning                                                                                                                            |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `url`       | required               | Base URL of the key-value resource. A trailing slash is tolerated.                                                                 |
| `headers`   | none                   | Headers for every request, or a function answering them per request, awaited.                                                      |
| `fetch`     | `globalThis.fetch`     | Read when a request is made, so a polyfill installed later is honoured.                                                            |
| `keys`      | `true`                 | `false` drops `keys` from the adapter, for a server with no key list.                                                              |
| `available` | a `fetch` is reachable | Replaces the probe.                                                                                                                |
| `format`    | `JSON`                 | How request and response bodies are spelled. The server must speak the same format; changing it over existing data is a migration. |

## Behavior

- `headers` may be a function, called and awaited on every request, so a token read from it is never stale.
- `fetch` defaults to `globalThis.fetch`, read when a request is made rather than when the factory runs, so a polyfill installed later is honoured. `available()` answers whether a fetch is reachable, which is what lets a store fall back to another adapter without one.
- A stored `null` is the JSON body `null` and stays distinct from `404`. `undefined` is a removal.
- `format` replaces JSON for the request and response bodies, such as `superjson`; the server must speak the same format, and the `content-type` stays `application/json`. `available` overrides the fetch probe.
- Pass `keys: false` for a server with no key list; the adapter then has no `keys` member and a migration cannot enumerate this storage.
- Nothing is observed. Existing records keep their cached snapshots after external writes. Releasing a scope and acquiring fresh handles reloads storage; `get`, `set` and `remove` do not reload it. Use the simulcast bridge for live updates.
- `native` is `{ url }` with the base URL, trailing slash removed. `dispose` releases nothing; the server keeps the data.

## License

[MIT](LICENSE)
