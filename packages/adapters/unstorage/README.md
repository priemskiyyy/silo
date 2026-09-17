<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-unstorage

[unstorage](https://unstorage.unjs.io) adapter for [silo](../../core): asynchronous persistence through any unstorage driver, from the filesystem and Redis to Cloudflare KV, Vercel KV, and the rest of its driver list.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-unstorage @priemskiyyy/silo-memory unstorage
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { unstorage } from "@priemskiyyy/silo-unstorage";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";

const storage = createStorage({ driver: fsDriver({ base: "./data" }) });

const silo = new Silo({
  storages: {
    default: {
      adapters: [unstorage({ storage }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

silo.value("theme").set("dark");
await silo.value("theme").flush();
```

## Options

| Option      | Default      | Meaning                                                                                    |
| ----------- | ------------ | ------------------------------------------------------------------------------------------ |
| `storage`   | required     | The unstorage instance, with its driver already mounted.                                   |
| `available` | `() => true` | Replaces the probe, so a candidate list can be gated by application state at construction. |

## Behavior

- `unstorage` is the application's dependency: create the storage with the driver you want and hand it over. The adapter depends on nothing and `silo.native.default` is that storage.
- Keys are percent encoded before they reach unstorage, because unstorage turns `/` into `:`, drops `?` and what follows, and collapses runs of `:`. `keys` decodes them back, and lists a key another writer stored under a plain name as it is.
- Values are JSON encoded on the way in and parsed on the way back, because unstorage parses stored strings itself and would hand a stored `"42"` back as the number 42. What JSON cannot express does not survive, and `undefined` is a removal.
- A stored `null` stays distinct from an absent key: unstorage answers `null` for both, so the adapter asks `hasItem` on a `null` answer.
- `available` defaults to `() => true` because the storage was handed over. Pass your own probe to gate this candidate on application state at construction, so a list such as `[unstorage(...), memory()]` falls through when it answers `false`.
- No change observation. A write from another process does not update an existing record. Release its scope and acquire a fresh handle to reload storage after consumers stop using the old handle.
- The adapter is asynchronous whatever the driver is, so a store over it takes asynchronous migrations.

## License

[MIT](LICENSE)
