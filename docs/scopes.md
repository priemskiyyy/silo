---
description: "Silo scopes: the same storages under a key prefix for per-user or per-document values, nested scopes, schema-driven clear(), release(), and how keys compose."
---

# Scopes

A scope is the same storages under a key prefix. One declaration of `theme` can
hold a different value per account, per document, or per workspace, with the
same types and the same handles.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

const userId = "42";
const account = silo.scope(`users:${userId}`);

account.value("theme").set("dark"); // silo:users:42:theme
silo.value("theme").get(); // "light": the root scope is untouched
```

A scope handle provides:

```ts
account.value("theme"); // the same typed handle, under this prefix
account.value("secure.token"); // keys of every storage, addressed the same way
account.scope("docs:7"); // a nested scope
await account.clear(); // remove every declared key at this scope
await account.release(); // flush and free this scope and its descendants
```

`status`, `native`, `ready`, `flush`, `diagnostics` and `dispose` stay on the
store, because they are properties of the store, not of a prefix. The store
itself is the root scope, and `SiloScope<TStorages>` is the handle's type.

## The key layout

Keys compose with a single `:` separator, per storage:

```text
${namespace}:${...scopeSegments}:${key}

silo:theme                      silo.value("theme")
silo:users:42:theme             silo.scope("users:42").value("theme")
silo:users:42:docs:7:theme      silo.scope("users:42").scope("docs:7").value("theme")
silo:users:42:token             silo.scope("users:42").value("secure.token"), in the secure storage
```

The core composes that string and the adapter treats it as opaque: no adapter
prefixes, trims or normalizes it. The storage name is not part of the key; a
scope spans every storage, and each storage's own namespace applies to the keys
that live there. See [Storages and namespaces](storages.md).

| Part        | Written by           | Rules                                                    |
| ----------- | -------------------- | -------------------------------------------------------- |
| `namespace` | You, at construction | No `:`. Defaults to `"silo"`. `""` is legal and special. |
| segments    | Runtime data         | Non-empty. Validated in `scope()`, which throws.         |
| key         | Your schema literal  | Non-empty, no `:` and no `.`. Validated at construction. |

`namespace` defaults to `"silo"` rather than to no prefix on purpose: an
application's `localStorage` already holds other libraries' keys, and an
unprefixed schema key named `theme` or `token` would overwrite one on the first
write, unrecoverably.

## Cached handles

`silo.scope("users:42").value("theme")` returns the same handle per physical key
until the scope is released or the store is disposed. Unsubscribing does not
release a record. Applications that visit many accounts or documents should
release each scope when its consumers finish using it.

## release

```ts
await account.release();
```

Release waits for writes in this scope and its descendants across every storage,
then frees their cached records. It leaves stored data and adapters intact. It
creates no records or reads, and it includes writes and records added while it
is waiting. A failed write rejects release and leaves the records available for
recovery; continuous writes can keep release pending.

Old value handles retain their last snapshot, stop notifying, and ignore writes.
A pending hydration promise rejects when its record is released. The scope
handle itself remains usable: calling `account.value("theme")` afterward creates
a fresh record and hydrates it from storage.

Release a scope after its consumers have stopped using their value handles.
Framework bindings unsubscribe on unmount; they do not release shared scopes.
Use `await silo.release()` to release the entire cache while keeping Silo alive.
Use `silo.dispose()` when the whole store is finished. [Memory and lifetime](internals/memory.md)
measures what a released record gives back.

## clear

```ts
await account.clear();
```

`clear()` removes every key **the current schema declares** at that scope, in
every storage, and returns a barrier over those removals, so awaiting it means
the deletions reached every backend. Records the scope had not reached yet are
not hydrated first: there is no point reading a value about to be removed.

::: warning It is schema driven
A key written at that scope by an **older version of your schema** is not in the
current schema, so `clear()` does not know about it and it survives, even if the
adapter supports key enumeration. Remove obsolete keys in a
[migration](migrations.md). `clear()` covers this exact scope; `release()` also
covers descendants.
:::

A sign-out that must leave nothing behind therefore clears the account scope and
migrates away anything the current schema no longer declares.

## A segment may contain the separator

`scope()` validates that a segment is non-empty and nothing else. In
particular, `:` is allowed, which keeps `scope("users:42")` the natural spelling
it is used as everywhere in these docs. For example:

```ts
silo.scope("users:42").value("theme"); // silo:users:42:theme
silo.scope("users").scope("42").value("theme"); // silo:users:42:theme, the same key
```

These addresses refer to the same record. This means a segment built from untrusted input can reach another scope's keys. If
segments come from user-controlled data, encode them yourself:

```ts
const workspace = silo.scope(`ws:${encodeURIComponent("a:b")}`);

workspace.value("theme").get();
```

## Do not mix an empty namespace with scopes

`namespace: ""` opts into a shared keyspace: the namespace is dropped from the
join entirely rather than left as a leading separator. That makes one collision
possible:

```text
namespace ""      scope "a"   key "b"   -> a:b
namespace "a"     no scope    key "b"   -> a:b
```

Two stores over one backend, one of which opted into the shared keyspace, can
therefore land on the same physical key. Nothing detects it. Use `""` only for
a single store that must interoperate with keys someone else already writes, and
do not give that store scopes. A storage whose adapter hides the namespace, such
as the search params adapter, is in the same position on its own medium.

Migration metadata lives at `${namespace}::version` in the default storage.
Silo rejects any value address that would equal this reserved physical key.

## Patterns

**Per user.** Scope on the account once, after sign-in, and release it on
sign-out:

```ts
let account = silo.scope(`users:${session.userId}`);

const handleSignOut = async () => {
  await account.release();
  account = silo.scope(`users:${nextUserId}`);
};
```

**Per document.** Nest a document scope under the account so a user's cached documents
can be released together, and release the document's scope when its editor closes:

```ts
const document = account.scope(`docs:${documentId}`);

document.value("draft").set(text);
await document.release(); // when the editor unmounts
```

The [Fieldbook example](examples.md) keeps each notebook's entries under
`notebooks:${name}`: switching notebooks swaps the scope, and "Clear this
notebook" is one `clear()` on it.

## In React

Pass `scope="users:42"` to `SiloProvider` to scope the hooks below it.
`useScope()` returns that scope for imperative operations. The application owns
its release, for example after an account's views have unmounted:

```ts
await silo.scope(`users:${previousUserId}`).release();
```

See [React](react.md) for the provider and hook APIs.
