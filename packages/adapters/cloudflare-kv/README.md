<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-cloudflare-kv

Persist [Silo](../../core) values in a Cloudflare KV namespace supplied by the application.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cloudflare-kv @priemskiyyy/silo-memory
```

Bind the namespace in `wrangler.toml` and pass the binding in:

```toml
[[kv_namespaces]]
binding = "SETTINGS"
id = "..."
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { cloudflareKv } from "@priemskiyyy/silo-cloudflare-kv";
import { memory } from "@priemskiyyy/silo-memory";

export default {
  async fetch(request: Request, env: { SETTINGS: KVNamespace }) {
    const silo = new Silo({
      storages: {
        default: {
          adapters: [cloudflareKv({ namespace: env.SETTINGS }), memory()],
          schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
        },
      },
    });

    const theme = silo.value("theme");
    await theme.hydrated();
    theme.set("dark");
    await silo.flush();
    silo.dispose();

    return new Response(theme.get());
  },
};
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `namespace` | required     | The KV binding the Worker was given.                                                                                       |
| `available` | `() => true` | Overrides the synchronous availability check.                                                                              |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- KV is eventually consistent: a write is visible on every edge within about a minute, so KV suits per-user settings and feature flags, not a counter. For strongly consistent storage inside a Durable Object, use `@priemskiyyy/silo-cloudflare-durable-objects`.
- Values are text: `JSON` by default, or the `format` you pass, which is anything with `stringify` and `parse`, so `superjson` and `devalue` drop in. Anything the format cannot express does not survive, and `undefined` is a removal. Changing the format over existing data is a migration, since the stored text stays what the old format wrote. Values are read back in text mode, because only text tells a stored `null` from an absent key.
- `available` defaults to `() => true` because the binding was handed over. Pass your own probe to gate this candidate on application state at construction, so a list such as `[cloudflareKv(...), memory()]` falls through when it answers `false`.
- `keys` lists everything the namespace holds, walking every page of `list`.
- One `Silo` per request, disposed when done. `dispose` leaves the underlying data and client intact.
- Nothing reports a change from another edge, so there is no `observe`.
- The binding type is structural, so `@cloudflare/workers-types` or the types `wrangler types` generates both fit with no cast.

## License

[MIT](LICENSE)
