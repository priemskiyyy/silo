---
description: "Expiring values in Silo: expires.in lifetimes and expires.at deadlines, the stored envelope, lazy expiry on read, the injectable clock, and adding expiry."
---

# Expiring values

A key can declare a lifetime or a fixed deadline. After expiry, it reads as
absent and is deleted when its stored value is next loaded.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const HOUR = 3_600_000;

const schema = {
  token: value<string>({ expires: { in: HOUR } }),
  theme: value<"light" | "dark">({ fallback: "light" }),
};

const silo = new Silo({
  storages: { default: { adapters: [memory()], schema } },
});

silo.value("token").set("abc");
silo.value("theme").set("dark");
```

`expires.in` is a lifetime in milliseconds. Each write computes a new deadline
from the injected clock: `now() + in`.

`expires.at` is a fixed Unix timestamp in milliseconds. Rewriting the value
keeps the same deadline:

```ts
const invitation = value<string>({
  expires: { at: Date.UTC(2030, 0, 1) },
});
```

`Expiration` is the exported type of the option: exactly one of `in` or `at`.
Omitting `expires` disables expiry.

## Only an expiring key is enveloped

A key that declares `expires` is stored wrapped. Both options persist an
absolute deadline:

```ts
silo.native.default.get("silo:token"); // { value: "abc", expires: { at: 1758067200000 } }
silo.native.default.get("silo:theme"); // "dark", bare, with no wrapper at all
```

Everything else persists **bare**, with no wrapper of any kind. That is frozen
behavior, not an implementation detail: the value another tool reads out of
`localStorage` is the value you set, and nothing pays for a feature it does not
use.

The envelope wraps the **encoded** value, so a [codec](schema-and-codecs.md)
never sees it. `encode` produces the payload, the store wraps it, and on the way
back the store unwraps before `decode` runs. A migration sees the envelope
whole, because [migrations](migrations.md) work on raw values.

## Adding expiry is not a breaking change

The read is deliberately tolerant. A raw value that is not an envelope, meaning
it is not an object with both a `value` and a numeric `expires.at`, is read as a
bare value that never expires:

```text
stored before the change   "abc"                                  -> read as "abc", never expires
written after the change   { value: "abc", expires: { at: ... } }  -> expires
```

So adding `expires` to a key that already has data in the field is safe. The
values already out there keep working and pick up expiry the next time they are
written.

::: warning Removing it is breaking
The unwrapping only happens for a key that still declares `expires`. Delete
the option and a previously written envelope is handed to `decode` whole: with a
validating schema that is a decode failure and an error status, and without one
your value silently becomes `{ value, expires: { at } }`. If you have to remove
expiry, clear or rewrite the key in a [migration](migrations.md).
:::

## Expiry is lazy

There is no timer anywhere. Expiry is checked when a raw value arrives from the
adapter, which is at hydration and on a change observed from outside. Two
consequences:

- A value already in the snapshot does not expire while the page is open.
  `get()` keeps returning it until another adapter load checks its deadline,
  such as hydration in a new store after a page reload.
- An expired value is not merely hidden. It reads as absent, so the snapshot
  takes the fallback, and the deletion goes through the ordinary write
  pipeline. Ordering holds, `flush()` covers it, and the key is really gone.

If you need a value to stop being valid at a precise moment while the page is
open, compare timestamps yourself, or `remove()` it from a timer you own.

## Testing it without waiting

The clock is an option. Pass `now` and expiry is deterministic:

```ts
const store = memory();
let clock = 0;

const first = new Silo({
  storages: { default: { adapters: [store], schema } },
  now: () => clock,
});

first.value("token").set("abc");
first.value("token").get(); // "abc"

clock += HOUR + 1;

const second = new Silo({
  storages: { default: { adapters: [store], schema } },
  now: () => clock,
});

second.value("token").get(); // undefined: expired on the way in
store.native.has("silo:token"); // false: and deleted
```

Two stores over one adapter is what a reload looks like from the storage's point
of view, which is the thing worth testing. `now` defaults to `Date.now`, and
nothing else in the runtime reads the clock, so no test ever needs fake timers
for this. See [application testing](testing.md).

## Expiry and the medium's own lifetime

Some media expire on their own. A cookie's `maxAge` and a Redis TTL delete the
raw value on the server's or the browser's clock, independently of the store;
`expires` decides when the store stops trusting a value it can still read. The
two act independently. A cookie's `maxAge` can remove it while Silo still holds
a cached snapshot; Silo checks its own deadline the next time raw data arrives. Use the medium's lifetime for housekeeping
and `expires` for a rule your application must be able to reason about.

## Choosing a lifetime

- A cached access token: its own expiry, minus a margin.
- A dismissed banner that should come back: days.
- Quiet hours, as in the [Fieldbook example](examples.md): store a deadline
  and compare it with the current time in the UI. Expiry also removes old data
  when it is loaded again.
- A draft: no expiry. Use `remove()` when it is submitted, so the deletion is an
  event you control rather than a deadline you guessed.

A key with `expires` and no fallback reads `undefined` once it expires, which
is usually what you want to branch on. A key with both reads its fallback again,
which can simplify a preference. Credentials should use an explicit absent
state when the application needs to distinguish expired data.
