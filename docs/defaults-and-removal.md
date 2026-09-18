---
description: "Silo fallbacks are read-time substitutes never persisted: how they type a key, how remove() and clear() reset to them, and why null is a stored value."
---

# Fallbacks and removal

A fallback is what a key reads as when nothing is stored. It is called
`fallback` rather than `default` because it is **never written**: it
substitutes at read time and leaves the backend empty.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
        token: value<string>(),
        lastSeen: value<string | null>({ fallback: null }),
      },
    },
  },
});

const theme = silo.value("theme");

theme.get(); // "light"
silo.native.default.size; // 0: the fallback was read, nothing was written
```

That is what makes a fallback changeable. Ship `fallback: "dark"` in the next
release and every user who never chose a theme gets the new one, because
their storage was never seeded with the old one. A default that had been
persisted would be frozen into every installation forever.

If a value must exist on disk, write it: `theme.set("light")`. A fallback is
not a seed.

## The type follows the fallback

```ts
const token = silo.value("token");

theme.get(); // "light" | "dark"
token.get(); // string | undefined
```

A key that declares a fallback reads as its value type. A key that does not
reads as `TValue | undefined`, and the compiler makes you handle the absent
case. This is the whole reason `value` is a pair of overloads: the presence
of `fallback` is carried into the inferred type as
`ValueDefinition<TValue, TFallback>`, not checked at runtime.

The same rule reaches every binding. `useValue("theme")` is typed
`"light" | "dark"` once the store is registered, and `useValue("token")` is
`string | undefined`.

## One shared reference

The fallback is the definition's own object. Every reader of an absent key,
in every scope using that definition, gets the same reference. Tabs and server
requests do not share JavaScript object identity. An object fallback
is under the same immutability rule as any
[stored value](reactive-values.md): mutating it corrupts what every other
reader sees.

Declare object fallbacks once, at module scope, and never mutate them:

```ts
const EMPTY_SUPPLIES: ReadonlyMap<string, number> = new Map();

const Schema = {
  supplies: value<ReadonlyMap<string, number>>({ fallback: EMPTY_SUPPLIES }),
};
```

Stable references prevent unnecessary snapshot updates within a runtime. Server
and client markup still need to agree; a browser may already hold a different
stored value. See [server rendering](server-rendering.md).

## remove

```ts
theme.set("dark");
theme.remove();

theme.get(); // "light": back to the fallback, immediately
```

`remove()` submits the deletion to the write queue, then commits the fallback
and status before notifying subscribers. It never leaves a defaulted key reading
`undefined`, and that is exactly what makes it idempotent across a reload:
after `remove()` the key reads `"light"`, and after a reload, where the key is
absent, it also reads `"light"`. The same code path, the same answer.

For a key with no fallback, removal reads as `undefined`:

```ts
token.set("abc");
token.remove();

token.get(); // undefined
```

Like `set()`, `remove()` never throws on a failed deletion. It takes a
revision, so `flush()` covers it and a failure lands on `status` with
`error.phase: "write"`.

## clear

`clear()` is `remove()` for every declared key of every storage at one scope:

```ts
await silo.clear(); // every key, every storage, at the root
await silo.scope(`users:${userId}`).clear(); // only that user's keys
```

It is schema driven. A key an older schema wrote at the same scope survives,
because the store does not know it exists; that is a job for a
[migration](migrations.md). The returned promise is the flush barrier over
the removals it issued. See [scopes](scopes.md) for what a scope owns.

## undefined means absent

`undefined` is not a value Silo stores. It is the answer for "there is
nothing here", and it is the only thing that means that:

- An adapter returns `undefined` for a key it does not hold.
- `set(undefined)` is a removal. The core never asks an adapter to store
  `undefined`, so no backend has to invent a representation for it.
- On a key with a fallback, `set(undefined)` does not even compile, because
  the value type does not include it. Call `remove()`.

```ts
token.set(undefined); // identical to token.remove()
```

A text backend gets the same answer from its format: `JSON.stringify` turns
`undefined` into `undefined`, and the adapter treats that as a removal.

## null is an ordinary value

`null` round-trips. It is stored, it is distinct from absent, and it is a
legitimate fallback:

```ts
const lastSeen = silo.value("lastSeen");

lastSeen.set(null);
lastSeen.get(); // null, and the key exists on the backend

lastSeen.remove();
lastSeen.get(); // null again, but now the key is gone
```

The two states read the same here only because the fallback is also `null`.
They differ on the backend, and they differ for anything reading the storage
directly: `silo.native.default.has("silo:lastSeen")` is `true` in the first
case and `false` in the second. If that distinction matters to your
application, do not make `null` the fallback of a nullable key.

The [conformance suite](testing-adapters.md) pins this for every adapter: a
stored `null` round-trips and is distinguishable from an absent key.
