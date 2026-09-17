<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-redis

Redis adapter for [silo](../../core): asynchronous, JSON encoded persistence through the Redis client the application already connected, for a store that lives on the server.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-redis @priemskiyyy/silo-memory
```

Then one client: `ioredis`, `redis` or `@upstash/redis`.

## Create a silo

```ts
import Redis from "ioredis";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { redis } from "@priemskiyyy/silo-redis";

const client = new Redis(process.env.REDIS_URL);

const silo = new Silo({
  storages: {
    default: {
      adapters: [redis({ client, match: "silo:*" }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

const theme = silo.value("theme");

await theme.hydrated();
console.log(theme.get()); // the persisted value, or "light"
```

The other two clients fit the same option:

```ts
import { createClient } from "redis";
const client = await createClient({ url: process.env.REDIS_URL }).connect();
```

```ts
import { Redis } from "@upstash/redis";
const client = new Redis({ url, token, automaticDeserialization: false });
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `client`    | required     | A connected `ioredis`, `redis` or `@upstash/redis` client. Only `get`, `set`, `del` and `keys` are typed.                  |
| `match`     | `"*"`        | The pattern `keys()` lists. Pass the store's namespace on a shared Redis.                                                  |
| `available` | `() => true` | Replaces the probe, so a candidate list can be gated by application state at construction.                                 |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- The store is one namespace inside a shared Redis. `keys()` runs `KEYS` with `match`, which defaults to `*` and walks the whole keyspace, so pass the namespace, `match: "silo:*"` for the default one, and a migration only ever sees the store's own keys.
- Upstash must be created with `automaticDeserialization: false`. Otherwise its `get` parses stored JSON itself and hands back an object where the adapter expects the text.
- The client is handed over, so this package imports nothing from it and types only the four methods it calls: `get`, `set`, `del` and `keys`. The application connects the client and quits it; `dispose` releases nothing and keeps the data.
- Values are text: `JSON` by default, or the `format` you pass, which is anything with `stringify` and `parse`, so `superjson` and `devalue` drop in. Anything the format cannot express does not survive, and `undefined` is a removal. Changing the format over existing data is a migration, since the stored text stays what the old format wrote. A stored string the format cannot parse rejects on read, which the core reports as a hydrate error and leaves in place for `set` to overwrite.
- `available` defaults to `() => true` because the client was handed over. Pass your own probe to gate this candidate on application state at construction, so a list such as `[redis(...), memory()]` falls through when it answers `false`.
- No Redis TTL is set. A value with an expiry expires lazily, on the read that finds it stale, and is then removed; until that read the key stays in Redis.
- Nothing reports a write another process made, so there is no `observe`. Existing records keep their cached snapshots. A fresh record acquired after scope release reads current storage.

## License

[MIT](LICENSE)
