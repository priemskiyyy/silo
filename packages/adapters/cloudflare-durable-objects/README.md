<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-cloudflare-durable-objects

Use a Durable Object storage instance with [Silo](../../core). The application supplies the object's storage.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cloudflare-durable-objects @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { DurableObject } from "cloudflare:workers";
import { Silo, value } from "@priemskiyyy/silo";
import { cloudflareDurableObjectStorage } from "@priemskiyyy/silo-cloudflare-durable-objects";
import { memory } from "@priemskiyyy/silo-memory";

export class Counter extends DurableObject {
  silo = new Silo({
    storages: {
      default: {
        adapters: [
          cloudflareDurableObjectStorage({ storage: this.ctx.storage }),
          memory(),
        ],
        schema: { visits: value({ fallback: 0 }) },
      },
    },
  });

  async fetch() {
    const visits = this.silo.value("visits");
    await visits.hydrated();
    visits.set(visits.get() + 1);
    await this.silo.flush();

    return new Response(String(visits.get()));
  }
}
```

## Options

| Option      | Default      | Meaning                                       |
| ----------- | ------------ | --------------------------------------------- |
| `storage`   | required     | The object's own `ctx.storage`.               |
| `available` | `() => true` | Overrides the synchronous availability check. |

## Behavior

- Durable Object storage is strongly consistent and lives with the object, which is what makes a counter safe here and not in Workers KV.
- Values pass through untouched, as structured clones, so a `Date` or a `Map` survives. `undefined` is a removal.
- `keys` lists everything the storage holds.
- One `Silo` per object instance, disposed with it. `dispose` leaves the underlying data and client intact.
- Nothing reports a change from outside the object, so there is no `observe`.
- `available()` is `true` unless `available` is given a probe of the application's own, so a candidate list can be gated at construction.
- The storage type is structural, so `@cloudflare/workers-types` or the types `wrangler types` generates both fit with no cast.

## License

[MIT](LICENSE)
