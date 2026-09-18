<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo

Typed, reactive persistence for TypeScript. Declare values and their storage
adapters, read synchronous snapshots, and subscribe to changes. The core also
provides scopes, validation, expiry, ordered writes, and migrations.

Start with the [getting started guide](https://priemskiyyy.github.io/silo/getting-started)
or browse [recipes](https://priemskiyyy.github.io/silo/recipes).

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory zod
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

import { z } from "zod";

const ThemeSchema = z.enum(["light", "dark"]);
const UserSchema = z.object({ name: z.string() });

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: {
        theme: value({ schema: ThemeSchema, fallback: "light" }),
        user: value({ schema: UserSchema }),
        session: value({ schema: z.string(), expires: { in: 3_600_000 } }),
      },
    },
  },
});

const theme = silo.value("theme");
const stop = theme.subscribe(() => console.log(theme.get()));

theme.get(); // "light" | "dark", never undefined
theme.set("dark"); // logs "dark"
await theme.flush(); // the write reached the adapter
stop();
```

`theme.get()` is `"light" | "dark"`, inferred from `ThemeSchema`;
`silo.value("user").get()` is `{ name: string } | undefined` because it does
not. An undeclared key is a compile error.

## What the core owns

- **Storages.** Named backends, each with its own schema and candidate list.
  Keys of `default` are addressed bare, keys of any other storage as
  `storage.key`, so the same key can live in several places.
- **Candidate adapters.** The first adapter whose `available()` probe passes
  and whose synchronous setup succeeds is chosen for the store's life.
  Every candidate is checked; if none works, construction throws. A memory
  fallback covers startup selection, not asynchronous open failures or later
  write failures.
- **Schema and codecs.** `value({ codec })` translates in both directions,
  `value({ schema })` validates with any Standard Schema validator such as Zod,
  Valibot or ArkType, and a key with neither trusts what is stored. Decoding
  runs once per inbound value, never on read.
- **Keyspaces.** Physical keys are `${namespace}:${...segments}:${key}`. The
  namespace is `"silo"` by default, per store or per storage, and an adapter
  such as `searchParams()` can hide it. A storage's `keys: { encode, decode }`
  can translate this address to an existing physical layout. Storage names
  themselves do not isolate physical keys.
- **Scopes.** `silo.scope("users:7")` addresses the same storages under a
  prefix; `clear()` removes that scope's declared keys and `release()` frees
  its cached records without deleting anything.
- **Expiry.** `expires: { in }` or `expires: { at }` envelopes only the keys
  that declare it, checked when a raw value arrives, against an injectable
  `now`.
- **Migrations.** Steps keyed by the version they produce, run in order before
  loading values, with a checkpoint saved after each successful callback and `copy`, `move` and
  `rename` across storages. Steps must tolerate retries after interruption,
  checkpoint failure, or concurrent initialization.
- **Write ordering.** One in-flight write per record with a latest-wins pending
  slot, `flush()` as the durability barrier, and an outside change that only
  commits while nothing local is in flight.
- **Failure as status.** `silo.status` and `value.status` carry
  `{ state: "error", error: { phase, cause } }` for `migrate`, `hydrate`, `read` and
  `write`; a failed decode leaves the raw value untouched.
- **Diagnostics.** `silo.diagnostics` is a snapshot of every storage and
  record plus a stream of events, and observing it creates no demand. The
  devtools are built on it.

## Subpaths

`@priemskiyyy/silo/testing` exports `testStorageAdapter`, the conformance
suite every adapter runs, with a value corpus and an external-write harness for
backends that observe. `@priemskiyyy/silo/mock` exports `createMockAdapter`,
which records every call, holds operations open, fails them on demand and emits
echoes, duplicates and stale changes, so an application test never needs a
backend.

## Writing an adapter

An adapter is a cold mapping of one backend onto a small contract: `mode`,
`name`, `native`, `get`, `set`, `remove`, `available`, `dispose`, and
optionally `keys`, `observe` and a `keyspace` declaration. It receives opaque
physical keys and owns serialization. `createStorageAdapter` supplies the
shared bookkeeping, and `createTextStorageAdapter` maps a backend that stores
text with a pluggable `format` such as `superjson`. See
[Writing an adapter](https://priemskiyyy.github.io/silo/writing-an-adapter).

## License

[MIT](LICENSE)
