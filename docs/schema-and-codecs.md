---
description: "Declare stored values with value(): typed fallbacks, codecs, validation with Zod, Valibot or ArkType, decode failures, and what survives each backend."
---

# Schema and codecs

Declare each value once, with its validator and fallback. Silo infers the value
type from the validator; you do not need to repeat it in a type argument.
This example uses Zod (`pnpm add zod`):

```ts
import { value } from "@priemskiyyy/silo";
import { z } from "zod";

const ThemeSchema = z.enum(["light", "dark"]);

const AppSchema = {
  theme: value({ schema: ThemeSchema, fallback: "light" }),
  visits: value({ schema: z.number().int().nonnegative(), fallback: 0 }),
  token: value({ schema: z.string() }),
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
  storages: { default: { adapters: [memory()], schema: AppSchema } },
});

silo.value("theme").get(); // "light" | "dark"
silo.value("visits").get(); // number
silo.value("token").get(); // string | undefined
```

A fallback removes `undefined` from the read type. Without one, the caller
handles a missing value. The schema checks incoming stored data; TypeScript
checks writes and the fallback.

If another part of your application needs the type, derive it from the same schema:

```ts
type Theme = z.infer<typeof ThemeSchema>;
```

For a reusable Silo schema, use `satisfies` to check its shape without widening
its values to `unknown`:

```ts
import type { SiloSchema } from "@priemskiyyy/silo";

export const PreferencesSchema = {
  theme: value({ schema: ThemeSchema, fallback: "light" }),
} satisfies SiloSchema;
```

Zod is optional. Simple values can infer their type from a fallback, or use an
explicit type when no runtime validation is needed:

```ts
value({ fallback: 0 }); // number
value({ fallback: "light" }); // string
value<"light" | "dark">({ fallback: "light" }); // "light" | "dark"
value<string>(); // string | undefined
```

These declarations trust data from storage. They do not validate it.
`InferSchema<typeof storages>` is available when you need a type mapping every
address in a store to its read value.

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

const UserSchema = z.object({ id: z.string(), name: z.string() });

export const user = value({ schema: UserSchema });
```

```ts [Valibot]
import { value } from "@priemskiyyy/silo";
import * as v from "valibot";

const UserSchema = v.object({ id: v.string(), name: v.string() });

export const user = value({ schema: UserSchema });
```

```ts [ArkType]
import { value } from "@priemskiyyy/silo";
import { type } from "arktype";

const UserSchema = type({ id: "string", name: "string" });

export const user = value({ schema: UserSchema });
```

:::

In all three, the key reads as `{ id: string; name: string } | undefined`,
inferred from the validator. Add a `fallback` and the `| undefined` goes away.
A schema that transforms, such as `z.coerce.number()`, is fine: the value type
is the validator's output.

A schema validates incoming values only. Writes store the schema's output type
as given, and the adapter handles serialization. Transforming schemas must also
accept that stored output on the next read; use a codec when writing and reading
need different conversions. Validators must be synchronous.

For example, URL parameters arrive as text:

```ts
const PageSchema = z.coerce.number().int().positive();
const page = value({ schema: PageSchema, fallback: 1 });
```

`PageSchema` accepts `"2"` from the URL and returns the number `2`. It also
accepts `2` if a structured adapter returns the stored number. See the complete
[URL recipe](recipes.md#shareable-state-in-the-url).

::: warning Types alone do not validate stored data
`value<User>()` checks your TypeScript calls, but accepts anything returned by
storage. Use a schema when older releases, other clients, or hand-edited data
could supply an incompatible value.
:::

## When decoding fails

If the initial stored value fails validation, Silo reports a hydration error
and uses the fallback, or `undefined` if none was declared. It leaves the stored
data untouched:

```ts
import { z } from "zod";

const UserSchema = z.object({ id: z.string(), name: z.string() });

const profile = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        user: value({ schema: UserSchema }),
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

Use a codec for application-specific conversion: a `Date` that has to survive
JSON on a text medium, or a `Set` written as an array. For a number in a plain-text URL, a coercing
schema is enough.

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
