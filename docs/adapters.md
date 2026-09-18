---
description: "Compare Silo's 23 storage adapters for the browser, React Native, Electron, Tauri, Node, Redis, Cloudflare and HTTP: mode, key listing, change observation and traps."
---

# Adapters

An adapter maps one storage backend onto the contract the runtime consumes. Each
one is a cold description: importing the module touches nothing, calling the
factory touches nothing, and the backend is resolved on first use. The core owns
keys, codecs, snapshots, demand, write ordering, coalescing, flush barriers,
expiry and migrations. The adapter reads and writes raw values at opaque keys
and reports changes it did not make.

**The adapter owns serialization, the codec owns validation.** The core hands an
adapter a decoded JavaScript value and expects one back, which is what keeps
`decode` a one-liner and keeps a `Date` alive through IndexedDB. The cost is that
the set of values that survive is a property of the backend, not of Silo. See
[Schema and codecs](schema-and-codecs.md).

Every adapter below is a package of its own, so an application installs only the
backends it runs on. Every factory takes `available`, and the text-based ones
take `format`; both are explained once, under
[Candidate lists](#candidate-lists-and-available) and
[Text formats](#text-formats), and only named in the tables.

## Compare the adapters

| Adapter                            | Package                                        | Mode    | `keys`                    | `observe`                                                                    | Namespace       | Values                       | Runs in               |
| ---------------------------------- | ---------------------------------------------- | ------- | ------------------------- | ---------------------------------------------------------------------------- | --------------- | ---------------------------- | --------------------- |
| `memory()`                         | `@priemskiyyy/silo-memory`                     | `sync`  | yes                       | none                                                                         | visible         | structured clone             | anywhere              |
| `localStorage()`                   | `@priemskiyyy/silo-local-storage`              | `sync`  | yes                       | `storage` event, other tabs                                                  | visible         | text, `format`               | browser               |
| `sessionStorage()`                 | `@priemskiyyy/silo-session-storage`            | `sync`  | yes                       | `storage` event, same-tab frames                                             | visible         | text, `format`               | browser               |
| `indexedDb()`                      | `@priemskiyyy/silo-indexeddb`                  | `async` | yes                       | announcements from other Silo adapters                                       | visible         | structured clone             | browser               |
| `cookie()`                         | `@priemskiyyy/silo-cookie`                     | `sync`  | yes                       | none                                                                         | visible, option | text, `format`               | browser               |
| `searchParams()`                   | `@priemskiyyy/silo-search-params`              | `sync`  | yes                       | back and forward, as `{ key: null }`; other tabs with `sharing: "cross-tab"` | hidden, option  | text, `format`               | browser               |
| `chromeStorage()`                  | `@priemskiyyy/silo-chrome-storage`             | `async` | yes                       | `onChanged`, one report per key                                              | visible         | what the platform serializes | browser extension     |
| `asyncStorage()`                   | `@priemskiyyy/silo-async-storage`              | `async` | yes                       | none                                                                         | visible         | text, `format`               | React Native          |
| `mmkv()`                           | `@priemskiyyy/silo-mmkv`                       | `sync`  | yes                       | MMKV's value listener                                                        | visible         | text, `format`               | React Native          |
| `secureStore()`                    | `@priemskiyyy/silo-expo-secure-store`          | `async` | no                        | none                                                                         | visible         | text, `format`               | Expo                  |
| `keychain()`                       | `@priemskiyyy/silo-react-native-keychain`      | `async` | yes                       | none                                                                         | visible         | text, `format`               | React Native          |
| `capacitorPreferences()`           | `@priemskiyyy/silo-capacitor-preferences`      | `async` | yes                       | none                                                                         | visible         | text, `format`               | Capacitor             |
| `icloud()`                         | `@priemskiyyy/silo-icloud`                     | `async` | yes                       | iCloud remote change notification                                            | visible         | text, `format`               | iOS                   |
| `electronStore()`                  | `@priemskiyyy/silo-electron-store`             | `sync`  | yes                       | `onDidAnyChange`, one report per key                                         | visible         | JSON, by the library         | Electron main, Node   |
| `tauriStore()`                     | `@priemskiyyy/silo-tauri-store`                | `async` | yes                       | the store's `onChange`                                                       | visible         | JSON, by the plugin          | Tauri                 |
| `jsonFile()`                       | `@priemskiyyy/silo-json-file`                  | `sync`  | yes                       | none                                                                         | visible         | JSON                         | Node                  |
| `sqlite()`                         | `@priemskiyyy/silo-sqlite`                     | `sync`  | yes                       | none                                                                         | visible         | text, `format`               | Node, Bun             |
| `redis()`                          | `@priemskiyyy/silo-redis`                      | `async` | yes, `KEYS` + `match`     | none                                                                         | visible         | text, `format`               | Node                  |
| `cloudflareKv()`                   | `@priemskiyyy/silo-cloudflare-kv`              | `async` | yes                       | none                                                                         | visible         | text, `format`               | Workers               |
| `cloudflareDurableObjectStorage()` | `@priemskiyyy/silo-cloudflare-durable-objects` | `async` | yes                       | none                                                                         | visible         | structured clone             | Durable Objects       |
| `unstorage()`                      | `@priemskiyyy/silo-unstorage`                  | `async` | yes                       | none                                                                         | visible         | JSON                         | wherever the driver   |
| `http()`                           | `@priemskiyyy/silo-http`                       | `async` | yes, unless `keys: false` | none                                                                         | visible         | text, `format`               | anywhere with `fetch` |
| `simulcast()`                      | `@priemskiyyy/silo-simulcast`                  | wrapped | wrapped                   | channel publications plus the wrapped one's                                  | wrapped         | wrapped                      | anywhere              |

Read the `observe` column strictly. It says what the backend can tell the
adapter about a write it did not make, and "none" means a change made elsewhere
does not update an already-cached record. Releasing its scope and acquiring a
fresh handle reloads storage. `get()`, `set()` and `remove()` do not reload it.
An observing adapter only sees the sources its platform or transport reports.
[External observation](external-observation.md) has the details.

The namespace column says whether the physical key carries the store's
namespace by default. Only the query string hides it, because a link reads
better as `?filter=open`; see [Namespaces in the medium](#namespaces-in-the-medium).

## Which one to reach for

| Requirement                                                       | Adapter                                          |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| A preference that survives a reload                               | `localStorage()`                                 |
| State that belongs to one tab and one visit                       | `sessionStorage()`                               |
| More than a few hundred kilobytes, or a `Date`, a `Map`, a `Blob` | `indexedDb()`                                    |
| A value the server must see on every request                      | `cookie()`                                       |
| Filters and sort orders that belong in a shareable link           | `searchParams()`                                 |
| A browser extension's settings, shared with its service worker    | `chromeStorage()`                                |
| React Native, read in the first frame                             | `mmkv()`                                         |
| React Native, no native module                                    | `asyncStorage()`                                 |
| A token on the device                                             | `secureStore()` on Expo, `keychain()` on bare RN |
| Capacitor, one API for iOS, Android and the web                   | `capacitorPreferences()`                         |
| Following the Apple ID across devices                             | `icloud()`, experimental                         |
| Electron's main process, or a Node tool                           | `electronStore()`, `jsonFile()`, `sqlite()`      |
| A Tauri window                                                    | `tauriStore()`                                   |
| A store on the server, shared by every process                    | `redis()`, `cloudflareKv()`, `unstorage()`       |
| Strong consistency at the edge                                    | `cloudflareDurableObjectStorage()`               |
| Values that follow the user from one device to the next           | `http()`, live across devices with `simulcast()` |
| Tests, a server render, a first prototype, the floor of any list  | `memory()`                                       |

Mode is not a preference. A synchronous adapter with no pending migration
hydrates inside `silo.value(key)`, so the first `get()` already returns
persisted data; an asynchronous one returns the fallback until hydration lands.
See [Synchronous and asynchronous](sync-vs-async.md).

## Candidate lists and `available`

A storage names an ordered list of adapters, not one. The store probes each
candidate's `available()` once, at construction, keeps the first that answers
`true` for its whole life, takes the last one regardless, and disposes the
rest. Ending every list with `memory()` is what makes a store construct
anywhere: on a server, in a private window with site data blocked, or on a
platform whose native module did not load.

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      // localStorage where the browser grants it, memory everywhere else.
      adapters: [
        localStorageAdapter({ available: () => consent.granted }),
        memory(),
      ],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

Every factory takes `available?: () => boolean`, which replaces the probe, so a
candidate can be gated by application state: a consent flag, `Platform.OS`, a
feature flag. The platform adapters probe the platform by default, and an
adapter that is handed its backend, such as a Redis client or an MMKV instance,
defaults to `true`, because the application already decided the backend exists.
Which adapter won is visible in `silo.diagnostics` and in the
[devtools](devtools.md) sidebar. [Storages and namespaces](storages.md) covers
the rest of the storage declaration.

## Text formats

Most backends hold strings. Those adapters are built on
`createTextStorageAdapter`, encode every value to text on the way in and parse
it on the way out, and take `format?: TextFormat`, an object with `stringify`
and `parse`. `JSON` is the default and the shape, so `superjson` and `devalue`
drop in as they are:

```ts
import superjson from "superjson";

localStorageAdapter({ format: superjson }); // a Date or a Map now survives the round trip
```

The rules are the same on every text adapter:

- What the format cannot express does not survive. With JSON a `Date` reads
  back as a string and a `Map` as `{}`.
- `stringify` answering `undefined` is a removal, the way
  `JSON.stringify(undefined)` is, so `undefined` is never written and always
  means absent. `null` is stored as text and stays distinct from an absent key.
- Text the format cannot parse throws on read. The core reports it as
  `{ state: "error", error: { phase: "hydrate" } }`, reads the fallback, and
  leaves the raw text in place so `set` can overwrite it.
- An observed change whose text will not parse is dropped rather than applied,
  so bad data from another tab never replaces a good snapshot.
- Changing the format over existing data is a migration, because the stored
  text stays what the old format wrote. See [Migrations](migrations.md).

Adapters that store by structured clone (`memory`, `indexedDb`, Durable
Objects) or hand the value to a library that serializes it (`chromeStorage`,
`electronStore`, `tauriStore`, `jsonFile`, `unstorage`) take no `format`: the
backend decides the corpus, and the section for each one names it.

## Namespaces in the medium

A physical key is `${namespace}:${...segments}:${key}`, `silo:theme` for a
store with the default namespace. Two adapters declare that their medium wants
it otherwise, through a `keyspace` declaration the store reads from whichever
candidate won:

- `searchParams()` declares `hidden`, so a link reads `?filter=open` rather than
  `?silo%3Afilter=open`.
- `cookie()` declares `visible`, because a cookie jar is shared with every other
  script on the site.

Both take `namespace: "visible" | "hidden"` to say otherwise, and a storage's
own `namespace` overrides the declaration for the keys that live there. The
migration version record stays under the default storage's namespace whatever
the other storages declare. [Storages and namespaces](storages.md) has the
precedence in full.

## `localStorage` and `sessionStorage` shadow the DOM globals

The factories are named after their providers, so importing one shadows the
same-named DOM global inside the importing module:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorageAdapter(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

// The DOM global is still reachable under its own name.
export const raw = globalThis.localStorage.getItem("silo:theme");
```

Alias the import in any module that also reaches for the platform directly. The
adapters themselves are immune: each reads `globalThis.localStorage` or
`globalThis.sessionStorage`, never the bare identifier.

## Browser

### Memory

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option      | Default      | Meaning                                            |
| ----------- | ------------ | -------------------------------------------------- |
| `available` | `() => true` | Replaces the probe, so the floor can be gated too. |

One `Map` per adapter, with `structuredClone` on write and again on read. That
is what makes it a store rather than a bag of live references: after
`silo.value("user").set(user)`, a later `user.name = "grace"` cannot reach the
persisted copy. `native` is the `Map` itself, so a test can seed it before
hydration or assert against it afterwards. `keys` lists the map, and
`dispose()` clears it.

#### Traps

- **Nothing persists.** The store lives in the adapter instance. Two `memory()`
  calls share nothing, and `dispose()` clears it. Put it last in a candidate
  list so it is the floor rather than the choice.
- **Its corpus is wider than the web's.** `Date`, `Map`, `Set`, `RegExp`,
  `BigInt`, typed arrays and circular references survive here and through
  IndexedDB, and none of them survive a text adapter under JSON. A schema
  proven against memory can still break on `localStorage`.
- **A class instance comes back as a plain object.** `structuredClone` copies own
  properties and drops the prototype, so methods and `instanceof` do not survive.
- **A value `structuredClone` refuses fails loudly.** A function or a DOM node
  throws `DataCloneError` from the adapter's `set`. The core contains it and
  reports `{ state: "error", error: { phase: "write" } }`.
- **Reading `native` bypasses the clone.** An entry taken out of the `Map` is the
  stored object, so mutating it corrupts persisted state with no notification.
- **No `observe`.** To drive the external-change path in tests, use
  `createMockAdapter`. See [Application testing](testing.md).

### localStorage

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorageAdapter(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

const theme = silo.value("theme");

theme.set("dark");
export const current = theme.get(); // "dark", read synchronously
```

| Option      | Default               | Meaning                                                            |
| ----------- | --------------------- | ------------------------------------------------------------------ |
| `available` | the platform resolves | Replaces the probe. Blocked site data and a server read as absent. |
| `format`    | `JSON`                | See [Text formats](#text-formats).                                 |

Synchronous, text encoded, shared by every tab on the origin, and kept until
the user or the application clears it. `native` is the `Storage`, or `null`
where there is none. `observe` listens for the `storage` event, which never
fires in the tab that wrote, so there is no echo to suppress; `event.key ===
null` is reported as `{ key: null }`. `keys` walks the area.

#### Traps

- **Roughly 5MB per origin**, shared with every other library writing to
  `localStorage`. Exceeding it makes `setItem` throw `QuotaExceededError`, which
  the adapter propagates. The core keeps the optimistic snapshot and reports
  `{ state: "error", error: { phase: "write" } }`, so `set()` still never throws
  in an event handler. Nothing is evicted and nothing is retried. See
  [Errors and recovery](errors-and-recovery.md).
- **Main-thread synchronicity.** Reads and writes complete in the calling frame.
  A large value blocks rendering while it is serialized and written. Keep values
  small; a document belongs in IndexedDB.
- **Safari private mode.** Current Safari grants a working `localStorage` in
  private browsing, cleared when the last private tab closes. Older versions kept
  the API and threw `QuotaExceededError` on every write, which arrives as the
  write-error status above.
- **Blocked site data.** The `globalThis.localStorage` getter itself throws
  `SecurityError`. The adapter resolves the platform once inside a guard, so it
  degrades to its server behavior instead of crashing at import, and the probe
  answers `false`, so the next candidate is chosen.
- **Both areas fire the same event on the same window**, so the adapter filters
  by `event.storageArea`. Filtering by key prefix instead would let a
  `sessionStorage` write masquerade as a local one.

### sessionStorage

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-session-storage @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { sessionStorage as sessionStorageAdapter } from "@priemskiyyy/silo-session-storage";

const silo = new Silo({
  storages: {
    default: {
      adapters: [sessionStorageAdapter(), memory()],
      schema: { step: value({ fallback: 0 }) },
    },
  },
});

export const step = silo.value("step");
```

| Option      | Default               | Meaning                                                            |
| ----------- | --------------------- | ------------------------------------------------------------------ |
| `available` | the platform resolves | Replaces the probe. Blocked site data and a server read as absent. |
| `format`    | `JSON`                | See [Text formats](#text-formats).                                 |

The same adapter as `localStorage()` over a different area. A session storage
area belongs to one tab: it survives a reload and a same-tab navigation, it is
copied into a tab duplicated from this one, and it is gone when the tab closes.
That makes it right for a wizard step, a scroll position or a draft, and wrong
for a preference the user expects to keep.

#### Traps

Everything in the `localStorage` list applies, with the quota counted per origin
per tab, plus:

- **Two tabs share nothing**, by design, so cross-tab observation has nothing to
  report. The `observe` that exists reaches same-tab browsing contexts sharing
  the session, in practice a same-origin iframe.

### IndexedDB

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-indexeddb @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { draft: value<{ body: string; savedAt: Date }>() },
    },
  },
});

export const save = async (body: string) => {
  const draft = silo.value("draft");

  await draft.hydrated();
  draft.set({ body, savedAt: new Date() });
  await draft.flush();
};
```

| Option      | Default            | Meaning                                                                                                   |
| ----------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `name`      | `"silo"`           | Database to open, also what `native.name` reports.                                                        |
| `store`     | `"values"`         | Object store to keep values in, created on first open.                                                    |
| `version`   | none               | Version to request. Omitted, the database opens at whatever version it already has.                       |
| `sharing`   | `"cross-tab"`      | Announce every write to the other tabs on this origin and observe theirs. `"single-tab"` drops `observe`. |
| `available` | `indexedDB` exists | Replaces the probe.                                                                                       |

Asynchronous, with one transaction per operation created and consumed in a
single synchronous stretch, awaiting only IndexedDB events. A write resolves
when its transaction completes, not when the request succeeds, so `flush()`
resolving means the data is committed rather than merely accepted. Values are
stored by structured clone with no serialization of any kind. `native` is
`{ name, version, database() }`, and `await silo.native.default.database()`
reaches the live `IDBDatabase`, reopening it if the browser closed it. `keys`
lists every string key in the store.

#### Traps

- **Structured-clone limits.** A function, a DOM node or anything holding one
  fails the write with `DataCloneError`, and a class instance comes back as a
  plain object without its prototype. The core reports the failure as
  `{ state: "error", error: { phase: "write" } }`.
- **Test binary values in your target browsers.** The browser suite covers
  `Blob` storage on Chromium and Firefox; that case is skipped for WebKit in
  the current test setup. The suite covers `ArrayBuffer` across all three.
  These checks do not establish support for every browser version or file type.
- **A database that already exists without this object store.** Opening at the
  current version runs no upgrade, so every operation fails with `NotFoundError`.
  Give Silo its own `name`, or pass a `version` higher than the existing one so
  the upgrade runs.
- **Pinning `version`.** It is then an error for the database to be newer: a tab
  running a later release upgrades it and this adapter reopens with a
  `VersionError`. Leaving `version` out is what keeps an upgrade in one tab from
  wedging another.
- **`blocked`.** When another connection holds the database at an older version,
  the open request stays pending until that connection closes. Reads and writes
  stay pending too and `hydrated()` waits, so the adapter logs a warning naming
  the database rather than waiting silently.
- **`versionchange`.** The adapter closes its own connection when another
  connection needs an upgrade, and drops the cached handle on `close`, so the
  next operation reopens instead of failing on a dead handle. It is never the
  connection that blocks someone else.
- **Observation is an announcement, not a change feed.** `observe` hears only
  what another Silo adapter on the same database and store announced after
  committing, over a `BroadcastChannel` named `silo:indexeddb:<name>:<store>`.
  A write from devtools, from another library, or a `deleteDatabase` goes
  unnoticed, and this adapter never reports `{ key: null }` itself.
- **Private browsing and blocked site data.** `indexedDB` can be absent or refuse
  to open. The probe answers whether it exists, so an absent one falls through to
  the next candidate; one that exists and refuses to open rejects the first
  operation with an error naming the database, reported as a hydrate error.

### Cookies

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cookie @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { cookie } from "@priemskiyyy/silo-cookie";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [
        cookie({ maxAge: 60 * 60 * 24 * 365, sameSite: "lax" }),
        memory(),
      ],
      schema: { locale: value<"en" | "de">({ fallback: "en" }) },
    },
  },
});

silo.value("locale").set("de"); // document.cookie now carries silo%3Alocale=%22de%22
```

| Option      | Default               | Meaning                                                                                        |
| ----------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `path`      | `"/"`                 | So one key is one cookie for the whole site, not one per directory.                            |
| `domain`    | none                  | Written as given.                                                                              |
| `secure`    | `false`               | Adds the `secure` attribute.                                                                   |
| `sameSite`  | none                  | `"strict"`, `"lax"` or `"none"`.                                                               |
| `maxAge`    | none                  | Lifetime in seconds. Omitted, the cookie lasts the session.                                    |
| `namespace` | `"visible"`           | Whether cookie names carry the store's namespace. See [Namespaces](#namespaces-in-the-medium). |
| `available` | the document resolves | Replaces the probe. No `document.cookie`, or cookies disabled, reads as absent.                |
| `format`    | `JSON`                | See [Text formats](#text-formats).                                                             |

Synchronous, text encoded, sent to the server on every request, and shared by
every tab on the site. The cookie name is the physical key and the value its
text, both URI encoded. `native` is the `Document`, or `null` where there is
none. `keys` lists every cookie the page can see, third-party ones included;
the core only ever reads its own namespace. A removal carries the same `path`
and `domain` as the write, with `max-age=0`.

#### Traps

- **About 4KB per cookie, and every cookie travels with every request.** Keep
  values small and few. The place for a locale or a theme, not for a draft.
- **The browser drops a bad write in silence.** A cookie over the size limit,
  `secure` on plain HTTP, or on a path the page is not under is never stored,
  and `document.cookie` does not say so. The adapter reads the header back after
  every write and throws when the cookie is missing, so the value reports a
  write error instead of a reload losing it.
- **No `observe`.** Another tab's cookie writes are seen on the next read, not
  live.
- **A server reads the raw header**, so the value there is the URI-encoded text
  of the format, `%22de%22` for the JSON string `"de"`. Decode with
  `decodeURIComponent` and the same format on the server.

### Search params

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-search-params @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";
import { z } from "zod";

const FilterSchema = z.enum(["all", "open", "done"]);

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorageAdapter(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    url: {
      adapters: [searchParams(), memory()],
      // The URL is untrusted input, so every key validates and falls back.
      schema: { filter: value({ schema: FilterSchema, fallback: "all" }) },
    },
  },
});

silo.value("url.filter").set("open"); // the address bar now reads ?filter=%22open%22
```

| Option      | Default               | Meaning                                                                                           |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------- |
| `hash`      | `false`               | Keep the parameters in the fragment, which never reaches a server log.                            |
| `sharing`   | `"single-tab"`        | `"cross-tab"` announces writes to the other tabs on this path, and writes theirs into this URL.   |
| `namespace` | `"hidden"`            | Whether parameter names carry the store's namespace. See [Namespaces](#namespaces-in-the-medium). |
| `available` | the location resolves | Replaces the probe. No `location`, or no `history.replaceState`, reads as absent.                 |
| `format`    | `JSON`                | See [Text formats](#text-formats).                                                                |

Synchronous, one parameter per key, so a value is a shareable link and
survives a reload. Writes go through `history.replaceState`, so nothing
navigates and no history entry is added. Back and forward are observed through
`popstate`, or `hashchange` for the fragment, and every navigation is reported
as `{ key: null }`, because it can change any number of parameters at once.
Parameters this adapter did not write are left exactly as they are. `native` is
the `Location`, or `null`. `keys` lists each parameter name once.

With `sharing: "cross-tab"`, every write is announced over a `BroadcastChannel`
named by the path, and each other tab on that path writes it into its own URL
before reporting it, so the address bars converge and a reload in any of them
reads the last write. `"single-tab"` is the default, because a URL is one tab's
by design. The query and the fragment use separate channels, and a tab on another
path is never reached.

A plain-text format keeps strings unquoted in the link, `?note=hello` instead
of `?note=%22hello%22`; the [Fieldbook example](examples.md) ships one, with an
integer codec beside it for the keys that are not strings.

#### Traps

- **Keep it a named storage.** Migrations are versioned by the record in the
  default storage, and a fresh or shared link carries no version, so a URL
  storage as `default` would run every migration on every visit.
- **A link written by an older release is not migrated either.** URL keys are
  untrusted input: give each one a `schema` and a `fallback`, and a parameter
  that does not validate reads as the fallback with a hydrate error on its
  status.
- **Strings are quoted under JSON.** `set("open")` writes `%22open%22`. Pass a
  `format` that leaves strings alone if the link is meant to be read by hand.
- **The router owns the same URL.** The adapter parses the location fresh on
  every read and rewrites only its own parameters, but a router that replaces
  the whole query string drops them. Report that as an outside change through
  `popstate` where the router allows it.
- **URL length limits vary** across browsers, servers and proxies. Keep
  query values small and test the complete deployment path.

### chrome.storage

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-chrome-storage @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { chromeStorage } from "@priemskiyyy/silo-chrome-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [chromeStorage({ area: chrome.storage.local }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

await silo.value("theme").hydrated();
```

| Option      | Default      | Meaning                                                                                 |
| ----------- | ------------ | --------------------------------------------------------------------------------------- |
| `area`      | required     | `chrome.storage.local`, `sync` or `session`. Firefox's `browser.storage` areas fit too. |
| `available` | `() => true` | Replaces the probe.                                                                     |

Asynchronous, serialized by the platform itself, and shared by every context of
the extension: popup, options page, content scripts and the service worker.
The area is handed over, so the same adapter serves all three, only the members
the adapter uses are typed, and the extension types are not a dependency.
`native` is the area. `observe` subscribes to the area's `onChanged` and
reports one change per key, a removal as `undefined`. `keys` reads the whole
area.

#### Traps

- **Store JSON-shaped data.** The platform serializes values itself, so a `Date`
  reads back as a string and `undefined` is written as a removal.
- **`sync` has quotas** per item, per area and on writes per minute and per hour.
  A refused write reaches the value's status as a write error.
- **The adapter hears its own writes.** `onChanged` fires in the context that
  wrote as well. The core drops reports while a local write is pending. A later echo
  can notify again if decoding produces a new object reference.
- **A cleared area arrives key by key**, never as one `{ key: null }` report.

## Mobile and native

### AsyncStorage

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-async-storage @priemskiyyy/silo-memory @react-native-async-storage/async-storage
```

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Silo, value } from "@priemskiyyy/silo";
import { asyncStorage } from "@priemskiyyy/silo-async-storage";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [asyncStorage({ storage: AsyncStorage }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

const theme = silo.value("theme");

await theme.hydrated();
theme.get(); // the persisted value, or "light"
```

| Option      | Default      | Meaning                                                                |
| ----------- | ------------ | ---------------------------------------------------------------------- |
| `storage`   | required     | The module's default export. Only the four methods it calls are typed. |
| `available` | `() => true` | Replaces the probe.                                                    |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                     |

Asynchronous, text, and kept on the device until removed. `native` is the
module. `keys` copies `getAllKeys`, so a migration can reach scoped data.
Nothing reports a change made elsewhere, so there is no `observe`.

#### Traps

- **Every read is a native round trip.** The first render carries the fallback;
  gate on `useValueStatus` or `hydrated()` where the first frame matters, or
  reach for `mmkv()` when it has to be synchronous.
- **Android caps the database at 6MB by default.** Raise it with
  `AsyncStorage_db_size_in_MB` in `gradle.properties`.
- **Two stores over the same module** do not see each other's writes until they
  read again.

### MMKV

The examples use MMKV 3 and its `new MMKV()` / `delete()` API. The adapter
currently expects that shape. MMKV 4 uses `createMMKV()` and `remove()`, so its
instance needs a compatibility wrapper. See the [MMKV API](https://github.com/mrousavy/react-native-mmkv#usage).

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-mmkv @priemskiyyy/silo-memory react-native-mmkv
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { mmkv } from "@priemskiyyy/silo-mmkv";
import { MMKV } from "react-native-mmkv";

const silo = new Silo({
  storages: {
    default: {
      adapters: [mmkv({ storage: new MMKV({ id: "app" }) }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

silo.value("theme").get(); // read synchronously, in the first frame
```

| Option      | Default      | Meaning                                                                      |
| ----------- | ------------ | ---------------------------------------------------------------------------- |
| `storage`   | required     | An `MMKV` instance. Its id, encryption key and path are constructor options. |
| `available` | `() => true` | Replaces the probe.                                                          |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                           |

Synchronous, text, and read in the calling frame, which is what makes it the
React Native adapter for anything the first render needs. `native` is the
instance. `keys` lists it. `observe` subscribes to
`addOnValueChangedListener`: MMKV reports the key alone, so the adapter reads
the value back before reporting.

#### Traps

- **The listener reports the application's own writes too.** The core drops
  the echo. A cleared instance arrives key by key, never as `{ key: null }`.
- **A native module.** Expo Go cannot load `react-native-mmkv`; a development
  build can.
- **One adapter per instance.** Two adapters over one `MMKV` see each other
  through the listener; two instances with different ids share nothing.

### Expo SecureStore

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-expo-secure-store @priemskiyyy/silo-memory
npx expo install expo-secure-store
```

```ts
import * as SecureStore from "expo-secure-store";
import { Silo, value } from "@priemskiyyy/silo";
import { secureStore } from "@priemskiyyy/silo-expo-secure-store";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    secure: {
      adapters: [secureStore({ store: SecureStore }), memory()],
      schema: { token: value<string>() },
    },
  },
});

const token = silo.value("secure.token");

token.set("eyJ...");
await token.flush();
```

| Option      | Default      | Meaning                                                                                         |
| ----------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `store`     | required     | The `expo-secure-store` module.                                                                 |
| `options`   | none         | `keychainService`, `requireAuthentication` and `authenticationPrompt`, forwarded to every call. |
| `available` | `() => true` | Replaces the probe.                                                                             |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                                              |

Asynchronous, text, in the iOS keychain and the Android keystore, for the
tokens and secrets an application must not keep in plain storage. `native` is
the module. Nothing reports a change from outside, so there is no `observe`.

#### Traps

- **No `keys`.** SecureStore cannot list what it holds, so a migration cannot
  enumerate this storage. `copy`, `move` and `rename` still work on keys a
  migration names.
- **Large values can fail.** Expo does not enforce a fixed size limit; some
  older iOS releases rejected values around 2 KiB. Handle native failures
  through the value's write status. See [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
- **Keys are encoded.** SecureStore accepts only `[A-Za-z0-9._-]`, so every
  physical key reaches the module as the unpadded base64url of its UTF-8 bytes.
  A key written by another library under its own name is not visible here.
- **The encoder uses `TextEncoder`**, which Hermes ships since React Native 0.74
  (Expo SDK 51).

### react-native-keychain

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react-native-keychain @priemskiyyy/silo-memory react-native-keychain
```

```ts
import * as Keychain from "react-native-keychain";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { keychain } from "@priemskiyyy/silo-react-native-keychain";

const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    secure: {
      adapters: [
        keychain({
          keychain: Keychain,
          options: { accessControl: "BiometryCurrentSet" },
        }),
        memory(),
      ],
      schema: { token: value<string>() },
    },
  },
});

silo.value("secure.token").set("eyJ...");
```

| Option      | Default               | Meaning                                                                            |
| ----------- | --------------------- | ---------------------------------------------------------------------------------- |
| `keychain`  | required              | The `react-native-keychain` module.                                                |
| `service`   | `{ prefix: "silo." }` | Every entry is one service named `${prefix}${encoded key}`.                        |
| `options`   | none                  | `accessible`, `accessControl` and `authenticationPrompt`, forwarded to every call. |
| `available` | `() => true`          | Replaces the probe.                                                                |
| `format`    | `JSON`                | See [Text formats](#text-formats).                                                 |

The bare React Native counterpart of Expo SecureStore: asynchronous, text, one
keychain entry per key. The keychain addresses entries by service, so every
key becomes the service `${prefix}${encodeKey(key)}`, with the plain key kept
as the entry's username for anyone reading the keychain by hand. `keys` lists
the services under the prefix and decodes them, skipping entries other
libraries wrote. `native` is the module. No `observe`.

#### Traps

- **The module answers `false` instead of throwing** when the platform refuses
  a write. The adapter turns that into a write error on the value's status.
- **iOS keychain items survive an uninstall.** Remove what must not, through
  `remove` or a migration, before relying on a fresh install.
- **`service` is set per key** and is not among the forwarded options.
- **The encoder uses `TextEncoder` and `TextDecoder`**, which Hermes ships since
  React Native 0.74.

### Capacitor Preferences

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-capacitor-preferences @priemskiyyy/silo-memory @capacitor/preferences
npx cap sync
```

```ts
import { Preferences } from "@capacitor/preferences";
import { Silo, value } from "@priemskiyyy/silo";
import { capacitorPreferences } from "@priemskiyyy/silo-capacitor-preferences";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [capacitorPreferences({ preferences: Preferences }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option        | Default      | Meaning                                                  |
| ------------- | ------------ | -------------------------------------------------------- |
| `preferences` | required     | The `Preferences` plugin, configured by the application. |
| `available`   | `() => true` | Replaces the probe.                                      |
| `format`      | `JSON`       | See [Text formats](#text-formats).                       |

Asynchronous, text, in `UserDefaults` on iOS, `SharedPreferences` on Android
and `localStorage` on the web, behind the one plugin API. `native` is the
plugin. `keys` lists what it holds. No `observe`.

#### Traps

- **Small values only.** The native stores behind the plugin are preference
  stores, not databases.
- **A group is the application's choice.** Call
  `Preferences.configure({ group })` once, before constructing the store.
- **On the web the plugin writes to `localStorage`** under a `CapacitorStorage.`
  prefix the adapter never sees, so `keys` lists the plain keys.

### iCloud key-value store

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-icloud @priemskiyyy/silo-memory react-native-cloud-store
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { icloud } from "@priemskiyyy/silo-icloud";
import { memory } from "@priemskiyyy/silo-memory";
import { mmkv } from "@priemskiyyy/silo-mmkv";
import { Platform } from "react-native";
import * as CloudStore from "react-native-cloud-store";
import { MMKV } from "react-native-mmkv";

const silo = new Silo({
  storages: {
    default: {
      adapters: [
        // iOS only, so the probe reads the platform and Android lands on MMKV.
        icloud({ store: CloudStore, available: () => Platform.OS === "ios" }),
        mmkv({ storage: new MMKV({ id: "app" }) }),
        memory(),
      ],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option      | Default      | Meaning                                                                   |
| ----------- | ------------ | ------------------------------------------------------------------------- |
| `store`     | required     | The `react-native-cloud-store` module.                                    |
| `available` | `() => true` | Replaces the probe; pass `Platform.OS === "ios"` on a cross-platform app. |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                        |

The experimental adapter of the set: asynchronous, text, and following the
Apple ID across the user's devices through `NSUbiquitousKeyValueStore`. A
change made on an iPhone reaches the same value on the iPad when iCloud
delivers it. `observe` subscribes to the platform's remote change
notification, which iCloud sends for changes received from other devices and
never for this application's own writes: each named key is read back and
reported with its value, and a change that names no keys, as on an account
change or the first sync, is reported as `{ key: null }`. `native` is the
module. `keys` lists every key the store holds, other libraries' included.

#### Traps

- **iOS, iPadOS and macOS Catalyst only.** Enable the iCloud capability with the
  key-value store in the entitlements. On Expo, add the library's config plugin
  and build a development build; Expo Go cannot load it.
- **1MB in total, at most 1024 keys, at most 1MB per value.** A write past the
  quota is not refused: the platform reports it later as a remote change with
  the quota reason, and the value stays what the device wrote.
- **Values follow the Apple ID.** A user who signs out or switches account sees
  a different store.
- **Delivery takes seconds to minutes**, and a remote change wins over a local
  one that had not synced yet.
- **Call `kvSync()` yourself** on launch and when the app returns to the
  foreground; the adapter never does.

## Desktop

### electron-store

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-electron-store @priemskiyyy/silo-memory electron-store
```

```ts
import Store from "electron-store";
import { Silo, value } from "@priemskiyyy/silo";
import { electronStore } from "@priemskiyyy/silo-electron-store";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [
        electronStore({ store: new Store({ watch: true }) }),
        memory(),
      ],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

silo.value("theme").get(); // read synchronously, from the file the library loaded
```

| Option      | Default      | Meaning                                                                 |
| ----------- | ------------ | ----------------------------------------------------------------------- |
| `store`     | required     | An `electron-store` or `conf` instance, constructed by the application. |
| `available` | `() => true` | Replaces the probe.                                                     |

Synchronous, JSON on disk by the library's own hand, and kept until removed.
The instance is handed over, so this package imports nothing from Electron:
the file name, the encryption key, `watch` and the schema are all
`new Store({ ... })`. `native` is that instance. `observe` subscribes to
`onDidAnyChange` and reports one change per key whose JSON differs, a removal
as `undefined`. `keys` lists the file's top-level keys.

#### Traps

- **Keys are percent encoded, dot included**, because the library reads a `.`
  in a key as a path into nested objects and a scope segment may carry one.
  `keys` decodes them back, and lists a key another writer stored under a plain
  name as it is.
- **The library refuses `__proto__`, `prototype` and `constructor`** as keys. A
  Silo key only ever equals one of those under an empty namespace.
- **Changes from another process arrive only with `watch: true`.** The library
  reports this process's own writes regardless, which the core drops as an echo.
- **Store what JSON can express.** `undefined` is a removal, and a stored `null`
  stays distinct from an absent key.
- **This adapter runs where the instance lives**, in the main process. A
  renderer reaches it through IPC of the application's own design.

### Tauri store

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-tauri-store @priemskiyyy/silo-memory @tauri-apps/plugin-store
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { tauriStore } from "@priemskiyyy/silo-tauri-store";
import { Store } from "@tauri-apps/plugin-store";

const store = await Store.load("state.json");

const silo = new Silo({
  storages: {
    default: {
      adapters: [tauriStore({ store }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option      | Default      | Meaning                            |
| ----------- | ------------ | ---------------------------------- |
| `store`     | required     | A loaded `Store` or a `LazyStore`. |
| `available` | `() => true` | Replaces the probe.                |

Asynchronous, serialized to JSON by the plugin itself, and kept in a file the
application named. A change made through the same store from another window or
from the Rust side arrives through the store's `onChange`, and so do this
adapter's own writes, which the core drops. `native` is the store. `keys` lists
it.

#### Traps

- **Autosave and `save()` stay the application's.** `dispose` releases the
  adapter's observers and nothing else; the file stays.
- **Subscribing goes over IPC**, so a change made in the first moments after
  `observe` can be missed. The first read covers it.
- **Store what JSON can express.** A `Date` reads back as a string and
  `undefined` is a removal.

### JSON file

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-json-file @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { jsonFile } from "@priemskiyyy/silo-json-file";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [jsonFile({ path: "~/.config/acme/state.json" }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});

silo.value("theme").set("dark"); // the file is rewritten in the calling frame
```

| Option      | Default      | Meaning                                                                                      |
| ----------- | ------------ | -------------------------------------------------------------------------------------------- |
| `path`      | required     | Resolved against the working directory. Created on the first write, parent folders included. |
| `available` | `() => true` | Replaces the probe.                                                                          |

Synchronous, loaded on first use, and rewritten whole on every write, through
a sibling temporary file renamed into place, so a crash mid-write leaves the
previous file intact. The adapter for a Node command line tool, a script, or
Electron's main process without `electron-store`. `native` is `{ path }` with
the absolute path. `keys` lists the file. No `observe`.

#### Traps

- **One process at a time.** Nothing coordinates two processes writing the same
  file, and a change made by another process is not noticed until the next
  start.
- **The whole file per write.** A burst of writes to a large file shows in a
  profile; a database belongs in `sqlite()`.
- **The file holds a JSON array of `[key, value]` entries**, so a key like
  `__proto__` is just a key. A file that is not valid JSON, or not an entries
  array, fails the operation that touched it, reported as a hydrate error.
- **Store what JSON can express.** `undefined` is a removal.

### SQLite

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-sqlite @priemskiyyy/silo-memory
```

```ts
import { DatabaseSync } from "node:sqlite";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { sqlite } from "@priemskiyyy/silo-sqlite";

const silo = new Silo({
  storages: {
    default: {
      adapters: [sqlite({ database: new DatabaseSync("state.db") }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option      | Default      | Meaning                                                                          |
| ----------- | ------------ | -------------------------------------------------------------------------------- |
| `database`  | required     | An open connection the application owns, opens and closes.                       |
| `table`     | `"silo"`     | The key-value table, created on first use. Letters, digits and underscores only. |
| `available` | `() => true` | Replaces the probe.                                                              |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                               |

Synchronous, text values in one table with `key TEXT PRIMARY KEY, value TEXT
NOT NULL`, created on first use, with the four statements prepared once. The
connection is handed over, so one adapter serves `node:sqlite`,
`better-sqlite3` and `bun:sqlite`, which share the statement API it uses.
`native` is the connection. `keys` lists the table. No `observe`.

#### Traps

- **`node:sqlite` ships with Node 22.13 and newer.** With `better-sqlite3` or
  `bun:sqlite`, pass `new Database("state.db")` instead.
- **One table per store.** Two stores over one database take two table names.
  The name is interpolated into SQL, which is why it is validated rather than
  quoted.
- **A row this adapter did not write**, text the format cannot parse or a value
  that is not text, throws on read, reported as a hydrate error and left in
  place for `set` to overwrite.
- **Journal mode, busy timeouts and the rest** are the application's `PRAGMA`s
  on the connection it hands over. Nothing reports a change made through
  another connection.

## Server and edge

### Redis

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-redis @priemskiyyy/silo-memory ioredis
```

```ts
import Redis from "ioredis";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { redis } from "@priemskiyyy/silo-redis";

const client = new Redis(process.env.REDIS_URL);

const silo = new Silo({
  storages: {
    default: {
      // `match` bounds `keys()` to this store's namespace inside a shared Redis.
      adapters: [redis({ client, match: "silo:*" }), memory()],
      schema: { maintenance: value({ fallback: false }) },
    },
  },
});

const maintenance = silo.value("maintenance");

await maintenance.hydrated();
maintenance.get(); // the persisted flag, or false
```

| Option      | Default      | Meaning                                                                                                   |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `client`    | required     | A connected `ioredis`, `redis` or `@upstash/redis` client. Only `get`, `set`, `del` and `keys` are typed. |
| `match`     | `"*"`        | The pattern `keys()` lists. Pass the store's namespace.                                                   |
| `available` | `() => true` | Replaces the probe.                                                                                       |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                                                        |

Asynchronous, text, and shared by every process on that Redis: the adapter for
typed configuration a Node service reads through cached snapshots. The client is handed over,
so this package depends on no client library. `native` is the client. No
`observe`.

#### Traps

- **`keys()` runs `KEYS`**, which walks the whole keyspace in one call. Always
  pass `match` on a shared Redis, `"silo:*"` for the default namespace, so a
  migration only ever sees the store's own keys.
- **Upstash needs `automaticDeserialization: false`.** Otherwise its `get`
  parses stored JSON itself and hands back an object where the adapter expects
  text.
- **No Redis TTL is set.** A value with an expiry expires lazily, on the read
  that finds it stale, and is then removed; until that read the key stays in
  Redis.
- **The application connects and quits the client.** `dispose` releases nothing.
- **Two stores over the same Redis** see each other's writes on their next
  read; keyspace notifications are not subscribed.

### Cloudflare Workers KV

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cloudflare-kv @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { cloudflareKv } from "@priemskiyyy/silo-cloudflare-kv";
import { memory } from "@priemskiyyy/silo-memory";

export default {
  async fetch(request: Request, env: { SETTINGS: KVNamespace }) {
    // One store per request, disposed when the request is done.
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

| Option      | Default      | Meaning                                                                                                                                    |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `namespace` | required     | The KV binding the Worker was given. The type is structural, so the types `wrangler types` emits and `@cloudflare/workers-types` both fit. |
| `available` | `() => true` | Replaces the probe.                                                                                                                        |
| `format`    | `JSON`       | See [Text formats](#text-formats).                                                                                                         |

Asynchronous, text, eventually consistent across the edge, and kept until
removed. Values are read in text mode, because only text tells a stored `null`
from an absent key. `keys` walks every page of `list`. `native` is the binding.
No `observe`.

#### Traps

- **Eventually consistent.** Remote locations can continue serving a cached value after a
  write, so KV suits per-user settings and feature flags, not a counter. A
  counter belongs in a Durable Object.
- **A store per request.** The binding outlives the request; the store should
  not. `dispose` releases nothing and deletes nothing.

### Cloudflare Durable Objects

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-cloudflare-durable-objects @priemskiyyy/silo-memory
```

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

| Option      | Default      | Meaning                                                 |
| ----------- | ------------ | ------------------------------------------------------- |
| `storage`   | required     | The object's own `ctx.storage`. The type is structural. |
| `available` | `() => true` | Replaces the probe.                                     |

Asynchronous, strongly consistent, and living with the object. Values pass
through untouched, because the runtime structured-clones them, so a `Date` or a
`Map` survives. One store per object instance, disposed with it. `native` is
the storage. `keys` lists it. No `observe`.

#### Traps

- **`undefined` is a removal.** The runtime has no spelling for it either.
- **Nothing reports a change from outside the object**, which by design there
  is none of: every request to the object runs through it.

### unstorage

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-unstorage @priemskiyyy/silo-memory unstorage
```

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
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
```

| Option      | Default      | Meaning                                                  |
| ----------- | ------------ | -------------------------------------------------------- |
| `storage`   | required     | The unstorage instance, with its driver already mounted. |
| `available` | `() => true` | Replaces the probe.                                      |

Asynchronous whatever the driver is, so a store over it takes asynchronous
migrations. Values are JSON encoded before they reach unstorage and parsed on
the way back, because unstorage parses stored strings itself and would hand a
stored `"42"` back as the number 42. `native` is the storage. `keys` lists the
driver's keys. No `observe`.

#### Traps

- **Keys are percent encoded**, because unstorage turns `/` into `:`, drops
  `?` and what follows, and collapses runs of `:`. `keys` decodes them back, and
  lists a key another writer stored under a plain name as it is.
- **A stored `null` stays distinct from an absent key.** unstorage answers
  `null` for both, so the adapter asks `hasItem` on a `null` answer, one more
  round trip on that path.
- **Store what JSON can express.** `undefined` is a removal.
- **No `format`.** The JSON step is fixed, because the driver decides what it
  does with the string underneath.

## Remote

### HTTP

This adapter speaks a key-value contract of its own: four routes under one
base URL, listed below. Your server implements them; the adapter does not talk
to an arbitrary API.

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-http @priemskiyyy/silo-memory
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { http } from "@priemskiyyy/silo-http";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

type Settings = { locale: string; digest: boolean };

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorageAdapter(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    remote: {
      adapters: [
        http({
          url: "https://api.example.com/kv",
          // Called on every request, so the token is never stale.
          headers: () => ({ authorization: `Bearer ${session.token}` }),
        }),
        memory(),
      ],
      schema: { settings: value<Settings>() },
    },
  },
});

const settings = silo.value("remote.settings");

await settings.hydrated();
settings.set({ locale: "en", digest: true });
await settings.flush();
```

| Option      | Default                | Meaning                                                                       |
| ----------- | ---------------------- | ----------------------------------------------------------------------------- |
| `url`       | required               | Base URL of the key-value resource. A trailing slash is tolerated.            |
| `headers`   | none                   | Headers for every request, or a function answering them per request, awaited. |
| `fetch`     | `globalThis.fetch`     | Read when a request is made, so a polyfill installed later is honoured.       |
| `keys`      | `true`                 | `false` drops `keys` from the adapter, for a server with no key list.         |
| `available` | a `fetch` is reachable | Replaces the probe.                                                           |
| `format`    | `JSON`                 | See [Text formats](#text-formats). The server must speak the same format.     |

Asynchronous, one resource per key under the base URL, where `{key}` is the
physical key percent encoded, for example `silo%3Ausers%3A7%3Atheme`. `native`
is `{ url }` with the base URL, trailing slash removed. No `observe`; the
[simulcast bridge](#simulcast-bridge) adds one.

| Request                                                                       | Answer                                                               |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `GET {url}/{key}`                                                             | `200` with the value as a JSON body, or `404` when the key is absent |
| `PUT {url}/{key}` with `Content-Type: application/json` and the value as body | any `2xx`                                                            |
| `DELETE {url}/{key}`                                                          | any `2xx`, or `404` for a key that was not there                     |
| `GET {url}`                                                                   | `200` with a JSON array of the physical keys the server holds        |

Any other status fails the operation with an error naming the method, the
resource and the status, which the core reports on the value's status as a
hydrate or write error. A network failure from `fetch` propagates as it is.

#### Traps

- **A stored `null` is the JSON body `null`** and stays distinct from `404`.
  `undefined` is a removal.
- **External writes do not update cached records.** A fresh handle acquired
  after scope release reloads the key. `get()`, `set()` and `remove()` do not
  reload it. Wrap the adapter in `simulcast()` for live updates.
- **The `content-type` stays `application/json`** whatever `format` is, so a
  server that switches on it must accept the format's text under that type.
- **`keys: false`** removes `keys` entirely, so a migration cannot enumerate
  this storage; `copy`, `move` and `rename` still work on keys it names.

### simulcast bridge

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-simulcast @priemskiyyy/simulcast
```

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { http } from "@priemskiyyy/silo-http";
import { memory } from "@priemskiyyy/silo-memory";
import { simulcast } from "@priemskiyyy/silo-simulcast";
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { ably } from "@priemskiyyy/simulcast-ably";

type Settings = { locale: string; digest: boolean };

const realtime = new RealtimeClient({ adapter: ably({ client: ablyClient }) });
realtime.connect();

const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    remote: {
      adapters: [
        simulcast({
          // The wrapped adapter holds the data and decides the mode.
          adapter: http({ url: "https://api.example.com/kv" }),
          // The channel delivers the writes other devices made.
          channel: realtime.channel("silo"),
        }),
        memory(),
      ],
      schema: { settings: value<Settings>() },
    },
  },
});

const settings = silo.value("remote.settings");

settings.subscribe(() => render(settings.get())); // runs when any device writes
```

| Option      | Default               | Meaning                                                                                            |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `adapter`   | required              | The adapter that holds the data. Its mode, `native` and `keys` are the bridge's.                   |
| `channel`   | required              | Anything with `subscribe(onPublication)` returning a stop; `realtime.channel(name)` fits as it is. |
| `publish`   | none                  | Announces this device's own writes after each one lands, for a setup where the server does not.    |
| `available` | the wrapped adapter's | Replaces the probe.                                                                                |

Live change notifications for any adapter, delivered over a
[simulcast](https://priemskiyyy.github.io/simulcast/) channel on whichever
provider the application already runs: Ably, Pusher, Centrifugo, Supabase,
Phoenix, MQTT, PartyKit, Socket.IO, a plain WebSocket, server-sent events, or a
`BroadcastChannel` between tabs. Silo owns what is stored and how it is read;
simulcast owns the realtime subscription.

1. A write goes to the wrapped adapter and is durable once that adapter says
   so. The bridge adds nothing to the write path.
2. Someone announces the change on the channel as `{ key, value }`. The
   natural announcer is the server that stored the value. For a setup without
   one, such as `localStorage` plus a `BroadcastChannel` provider, pass
   `publish` and the bridge announces this device's own writes after each one
   lands, never before, and never for a write that failed.
3. Every other device's store is subscribed to the channel through the bridge's
   `observe`. A publication arrives as an outside change: the snapshot updates,
   subscribers are notified, nothing is re-read.
4. A device may hear its own announcement. The core drops reports while a
   local write is pending. A later echo can notify again if decoding creates
   a new object reference.

The wrapped adapter's own `observe`, when it has one, keeps working alongside
the channel. The adapter's name becomes `${name}+simulcast`, which is how the
devtools show it.

A publication's `data` is one of:

```ts
{ key: "silo:theme", value: "dark" }   // a write: the physical key and the adapter-level value
{ key: "silo:theme" }                   // a removal; JSON has no undefined, so value is absent
{ key: null }                           // everything changed, re-read every key
```

Anything else on the channel is ignored, so the channel can carry other
traffic.

#### Traps

- **Missed publications need recovery.** The bridge does not reload cached
  records on reconnect. Configure replay in the transport where available, or
  release affected scopes and acquire fresh handles after their consumers stop.
- **Values on the channel are adapter-level values**, the shape the wrapped
  adapter's `get` returns, because the core applies them through the codec's
  `decode` and nothing else.
- **A `publish` that throws or rejects is dropped**, because the data is durable
  and the write must not report otherwise.
- **The wrapped adapter's `keyspace` declaration travels with it.** Wrapping
  `searchParams()` keeps the namespace out of the URL, and the storage's own
  `namespace` still overrides both.
- **`dispose` releases the bridge's observers, then disposes the wrapped
  adapter.** The channel and the `RealtimeClient` belong to the application.

## On the server

The browser adapters survive a server render without a guard: nothing runs at
import and nothing runs in the factory, and their probes answer `false`, so a
candidate list that ends in `memory()` lands there. Where a browser adapter is
the only candidate, `get` reads `undefined`, so every value takes its fallback,
`native` is `null`, and `set` and `remove` throw a named error the core turns
into a write-error status rather than a crash. `memory()` works anywhere and is
the adapter to use when a server render has to store something. The server
adapters, Redis, KV, Durable Objects, unstorage, SQLite and the JSON file, are
the other half: a store constructed per request or per process, with
asynchronous migrations where the backend is. See
[Server rendering](server-rendering.md).

## Adding one

The contract is four methods, a probe, a disposer and three fields, with
`keys`, `observe` and `keyspace` optional. `createStorageAdapter` supplies the
dispose bookkeeping and `createTextStorageAdapter` the text encoding, so a new
adapter over a string backend is a `read`, a `write` and a `remove`. See
[Writing an adapter](writing-an-adapter.md) for the rules and a complete worked
adapter, and [Adapter conformance](testing-adapters.md) for the suite every
adapter runs.
