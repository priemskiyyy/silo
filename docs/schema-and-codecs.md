---
description: "Declare stored values with value(): typed fallbacks, codecs, validation with Zod, Valibot or ArkType, decode failures, and what survives each backend."
---

# Schema and codecs

A schema is a flat object of `value(...)` entries, one per key of a storage.
Each entry declares what the key holds, what it reads as when absent, how it is
translated or validated on the way in, and how long it lives.

```ts
import { value } from "@priemskiyyy/silo";

type Theme = "light" | "dark";

const schema = {
  theme: value<Theme>({ fallback: "light" }),
  visits: value({ fallback: 0 }),
  token: value<string>(),
};
```

| Option     | Effect                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `fallback` | Read-time substitute. Never persisted, and it makes the key always defined.                                       |
| `codec`    | `encode` on the way out, `decode` on the way in. Exclusive with `schema`.                                         |
| `schema`   | A [Standard Schema](https://standardschema.dev) validator run on every inbound raw value. Exclusive with `codec`. |
| `expires`  | `{ in: milliseconds }` or `{ at: unixMilliseconds }`. See [Expiring values](ttl.md).                              |

Keys are literals in your source: non-empty, without `:` (the key separator)
and without `.` (what joins a storage name to a key). They are validated when
the store is constructed.

## What a key reads as

```ts
import { Silo } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: { default: { adapters: [memory()], schema } },
});

silo.value("theme").get(); // Theme
silo.value("visits").get(); // number
silo.value("token").get(); // string | undefined
```

A declared `fallback` carries into the type, so the key is never `undefined`.
Without one, the compiler makes you handle absence. This is why `value` is a
pair of overloads rather than one signature: the presence of the option, not
its value, decides the type. `ValueDefinition<TValue, TFallback>` is what an
entry is, with `TFallback` either `TValue` or `undefined`.

Two spellings, two results:

```ts
value({ fallback: "light" }); // string, widened from the literal
value<Theme>({ fallback: "light" }); // "light" | "dark"
```

Pass the type argument whenever the fallback is one member of a union. With a
`codec` or a `schema`, the value type comes from it and there is nothing to
pass.

`SiloSchema` is the constraint every schema literal satisfies, for a schema
declared in its own file:

```ts
import type { SiloSchema } from "@priemskiyyy/silo";

export const schema = {
  theme: value<Theme>({ fallback: "light" }),
} satisfies SiloSchema;
```

`satisfies` keeps each entry's own type; an annotation would widen every value
to `unknown`. `InferSchema<typeof storages>` maps every address of a store to
the type it reads as, when the application wants that object type elsewhere.

## Codecs

A codec is the translation between your value and the raw value the adapter
stores:

```ts
import type { Codec } from "@priemskiyyy/silo";

const isoDate = {
  encode: (value: Date) => value.toISOString(),
  decode: (raw: unknown) => new Date(String(raw)),
} satisfies Codec<Date>;

const events = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: { seenAt: value({ codec: isoDate }) },
    },
  },
});

events.value("seenAt").get(); // Date | undefined
```

`encode` runs on every write, inside `set()`, before anything is persisted. If
it throws, the throw reaches your caller and nothing was written.

`decode` runs **once per inbound raw value**, at hydration and on a change
observed from outside, never on a read. That is what keeps `get()` returning a
stable reference, as [reactive values](reactive-values.md) explains, and it also
means a codec runs far less often than you might expect.

## Validating with a Standard Schema

`value({ schema })` takes any [Standard Schema](https://standardschema.dev)
validator and runs it on every raw value as it arrives. The core inlines the
standard's types and depends on nothing, so Zod, Valibot and ArkType all fit
without a wrapper:

::: code-group

```ts [Zod]
import { value } from "@priemskiyyy/silo";
import { z } from "zod";

export const user = value({
  schema: z.object({ id: z.string(), name: z.string() }),
});
```

```ts [Valibot]
import { value } from "@priemskiyyy/silo";
import * as v from "valibot";

export const user = value({
  schema: v.object({ id: v.string(), name: v.string() }),
});
```

```ts [ArkType]
import { value } from "@priemskiyyy/silo";
import { type } from "arktype";

export const user = value({
  schema: type({ id: "string", name: "string" }),
});
```

:::

In all three, the key reads as `{ id: string; name: string } | undefined`,
inferred from the validator. Add a `fallback` and the `| undefined` goes away.
A schema that transforms, such as `z.coerce.number()`, is fine: the value type
is the validator's output.

`encode` stays the identity: the validator describes what is already there and
the adapter owns serialization. An asynchronous validator is refused rather
than making a decode awaitable, with an error naming the vendor that returned a
promise.

The URL is where this earns its keep. A query parameter is edited by hand, so
the [Fieldbook example](examples.md) validates its `filter` with a Zod enum: a
value outside it reads as the fallback with a hydrate error, instead of
reaching a component as a string that is not a `Filter`.

## A key with neither validates nothing

::: danger Read this before typing an interface
`value<User>()` declares what you **expect**. It checks nothing at runtime.
With no `codec` and no `schema`, `decode` is the identity, so whatever the
adapter hands back is returned as `User`, unexamined: a value written by an
older release of your own application, by a browser extension, by another tab,
or by a user editing devtools.

Compile-time typing and runtime validation are separate here on purpose. For a
theme you own end to end, the identity is right and costs nothing. For
anything crossing a trust boundary, add a `schema`.
:::

## When decoding fails

A stored value that will not decode is a normal, expected event: you changed a
shape, or something else wrote the key. The policy is fixed, and it errs toward
keeping data.

```ts
import { z } from "zod";

const profile = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        user: value({ schema: z.object({ id: z.string(), name: z.string() }) }),
      },
    },
  },
});

const user = profile.value("user");
const status = user.status.get();

if (status.state === "error" && status.error.phase === "hydrate") {
  user.set({ id: "1", name: "grace" }); // this is the recovery
}
```

The value and status update together. The value becomes the declared fallback,
or `undefined` when there is none. The status becomes
`{ state: "error", error: { phase: "hydrate", cause } }`, carrying the codec
error or the validator's issues. `hydrated()` resolves with that error recorded
in the status; it does not reject.

The raw data remains available for inspection or migration. `set()` overwrites
it and `remove()` deletes it. An `adapter.get()` failure uses the same fallback
and error status.

A decode failure arriving through
[observation](external-observation.md), keeps the last good snapshot instead of
falling back.

## What the adapter stores

Adapters own serialization, so a codec is not where JSON happens. An adapter
over a text medium (web storage, cookies, the URL, MMKV, secure stores, KV
stores, Redis, SQLite, HTTP) turns the raw value into text with `JSON` and back,
and every one of them takes a `format` option to replace it:

```ts
import superjson from "superjson";

adapters: [localStorage({ format: superjson }), memory()];
```

`TextFormat` is the `{ stringify, parse }` pair, so `superjson` and `devalue`
drop in as they are. Changing a format over data already written is a
[migration](migrations.md), because the old text no longer parses.

An adapter over a structured medium (memory, IndexedDB, Durable Object storage)
stores the value as given, which is what keeps a `Date` alive without a codec.

A codec is for the translation that is yours: a `Date` that has to survive
JSON on a text medium, a `Set` written as an array, a number carried by a URL
where every value arrives as text.

## What survives a round trip

The adapter decides, not the codec:

| Value                          | Structured (memory, IndexedDB) | Text with `JSON`  | Text with `superjson`               |
| ------------------------------ | ------------------------------ | ----------------- | ----------------------------------- |
| JSON shapes, `null`            | Yes                            | Yes               | Yes                                 |
| `Date`, `Map`, `Set`, `BigInt` | Yes                            | No, needs a codec | Yes                                 |
| Typed arrays, `ArrayBuffer`    | Yes                            | No, needs a codec | Verify the format's supported types |
| `undefined` as a stored value  | Never: it means absent         | Never             | Never                               |
| A class instance               | As a plain object              | As a plain object | As a plain object                   |

A schema proven against the memory adapter can still break on web storage, which
is the one place the backend leaks through. If a key has to work on both, give it
a codec that produces JSON, and let the [conformance suite](testing-adapters.md)
prove it on both backends. Each adapter's page in [Choose an adapter](adapters.md)
names its corpus.
