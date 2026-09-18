---
description: "Silo recipes: per-user scopes, query state in the URL, secure tokens, a live remote value over http and simulcast, no-flash themes, consent gating, migrations."
---

# Recipes

## Keep every user's values apart

Scope the provider by the signed-in user. Every hook below it reads and
writes under `users:<id>`, and switching users switches the keyspace without
touching a component:

```tsx
import { SiloProvider } from "@priemskiyyy/silo-react";

export const Application = ({ user }: { user: { id: string } }) => (
  <SiloProvider silo={silo} scope={`users:${user.id}`}>
    <Dashboard />
  </SiloProvider>
);
```

On sign-out, `clear()` removes declared keys at that exact scope across all
storages. It does not delete descendant scopes. After consumers unmount,
`release()` frees cached records in the scope and its descendants:

```ts
const account = silo.scope(`users:${user.id}`);

await account.clear();
await account.release();
```

See [scopes](scopes.md) for what a scope owns.

## Shareable state in the URL

Filters, sorting and a search query belong in the address bar, so a link
carries them. Keep them in a storage over `searchParams()`, with a plain text
format so the link reads `?filter=starred` rather than
`?filter=%22starred%22`, and validate each parameter with a Standard Schema
so a hand-edited value cannot reach the application:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import type { Codec, TextFormat } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";
import { z } from "zod";

// Every value comes back as text, so a key that is not a string carries its own codec.
const plainText: TextFormat = {
  stringify: (value) => (value === undefined ? undefined : String(value)),
  parse: (text) => text,
};

const integer: Codec<number> = {
  encode: (count) => String(count),
  decode: (raw) => {
    const count = Number(raw);

    if (!Number.isInteger(count)) {
      throw new Error(
        `Expected an integer in the URL, received "${String(raw)}".`,
      );
    }

    return count;
  },
};

const filterSchema = z.enum(["all", "today", "starred"]);

export const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    url: {
      adapters: [searchParams({ format: plainText }), memory()],
      schema: {
        filter: value({ schema: filterSchema, fallback: "all" }),
        page: value({ codec: integer, fallback: 1 }),
        query: value({ schema: z.string(), fallback: "" }),
      },
    },
  },
});

silo.value("url.filter").set("starred"); // the address bar now reads ?filter=starred
```

`searchParams()` hides the namespace by default, so the parameter is
`filter`, not `silo:filter`. Writes go through `history.replaceState`, so
nothing navigates, and the back button is observed. `sharing: "cross-tab"` announces
each write to the other tabs on the same path, which write it into their own
address bars, so a filter picked in one tab follows into the rest. A value
outside the enum
reads as the fallback with a `hydrate` error on its status. See
[storages and namespaces](storages.md) and
[schema and codecs](schema-and-codecs.md).

## A secure token beside plain preferences

One store, two storages: the preferences in a fast plain store, the token in
the keychain. Both are addressed through the same `silo`, and the key says
where it lives:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Silo, value } from "@priemskiyyy/silo";
import { asyncStorage } from "@priemskiyyy/silo-async-storage";
import { secureStore } from "@priemskiyyy/silo-expo-secure-store";

export const silo = new Silo({
  storages: {
    default: {
      adapters: [asyncStorage({ storage: AsyncStorage })],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    secure: {
      adapters: [
        secureStore({
          store: SecureStore,
          options: {
            requireAuthentication: true,
            authenticationPrompt: "Unlock your session",
          },
        }),
      ],
      schema: { token: value<string>() },
    },
  },
});

const token = silo.value("secure.token");

token.set("eyJ...");
await token.flush();
```

A bare React Native app swaps `secureStore` for `keychain` from
`@priemskiyyy/silo-react-native-keychain` and `asyncStorage` for `mmkv`,
which is synchronous, so the theme is right on the first frame.

## A remote value that updates on every device

`http()` holds the data on a REST key-value resource. On its own, a change
made on another device is not reflected in an already-cached record. Wrap it in the simulcast
bridge and a publication on the channel updates the value in place:

```ts
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { ably } from "@priemskiyyy/simulcast-ably";
import { Silo, value } from "@priemskiyyy/silo";
import { http } from "@priemskiyyy/silo-http";
import { memory } from "@priemskiyyy/silo-memory";
import { simulcast } from "@priemskiyyy/silo-simulcast";

const realtime = new RealtimeClient({ adapter: ably({ client: ablyClient }) });
realtime.connect();

type Settings = { locale: string; digest: boolean };

export const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    remote: {
      adapters: [
        simulcast({
          adapter: http({
            url: "https://api.example.com/kv",
            headers: () => ({ authorization: `Bearer ${session.token}` }),
          }),
          channel: realtime.channel("silo"),
        }),
        memory(),
      ],
      schema: { settings: value<Settings>() },
    },
  },
});

const settings = silo.value("remote.settings");

settings.subscribe(() => render(settings.get())); // rerenders when any device writes
```

The server stores the value on `PUT` and publishes `{ key, value }` on the
channel, once for every client. Without a server in the loop, pass `publish`
and the bridge announces this device's own writes after each one lands. The
[Fieldbook example](examples.md) runs this over a server that lives in the
page. See [external observation](external-observation.md).

## A theme with no flash on a warm start

The theme lives in a synchronous storage, so React reads it in its first
render. The browser still paints the default background before that render
runs. Read the raw key before React and set the scheme on the document:

```html
<script>
  (() => {
    let theme = "system";

    try {
      // The store's physical key, and JSON, because localStorage() stores text.
      const raw = localStorage.getItem("fieldbook:theme");
      theme = raw === null ? "system" : JSON.parse(raw);
    } catch {
      // A corrupt raw falls back like the store does.
    }

    const dark =
      theme === "dark" ||
      (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  })();
</script>
```

`fieldbook:theme` is `${namespace}:${key}` for a store constructed with
`namespace: "fieldbook"`. The script and the store read the same bytes, so
they cannot disagree. On a server, prefer a `cookie()` storage the server
can read. See [server rendering](server-rendering.md).

## A flag that expires

A dismissed banner that comes back after a week, a cached entitlement, a
quiet-hours toggle. Declare the lifetime on the key and the store handles
expiry when data is next loaded:

```ts
const Schema = {
  bannerDismissed: value({
    fallback: false,
    expires: { in: 7 * 24 * 60 * 60 * 1000 },
  }),
  quietUntil: value<number>({ expires: { in: 60 * 60 * 1000 } }),
};
```

Only keys that declare `expires` are enveloped, expiry is checked when the
raw value arrives, and an expired value reads as the fallback and is removed
through the ordinary write path. Inject `now` on the store to test it
without timers. See [expiring values](ttl.md).

## Storage behind a consent banner

The probe decides the candidate at construction. Gate `localStorage()` on
consent and let the list fall through to memory until the user agrees:

```ts
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const createSilo = (consent: { granted: boolean }) =>
  new Silo({
    storages: {
      default: {
        adapters: [
          localStorage({ available: () => consent.granted }),
          memory(),
        ],
        schema,
      },
    },
  });
```

The choice is made once, so construct a new store when consent changes and
hand it to the provider; the hooks follow the new `silo` prop. The
[Fieldbook example](examples.md) rebuilds its store the same way when the
Lab turns private mode on.

## Values JSON cannot spell

Every text backend stores JSON by default. A `Date`, a `Map` or a `Set`
survives IndexedDB's structured clone but not `localStorage`. Pass a richer
format and the adapter uses it on both sides:

```ts
import superjson from "superjson";
import { localStorage } from "@priemskiyyy/silo-local-storage";

const adapter = localStorage({ format: superjson });
```

Anything with `stringify` and `parse` fits, so `devalue` works the same way.
Changing the format over existing data is a migration: the stored text stays
what the old format wrote.

## Rename a key and move one to another storage

Migrations are keyed by the version they produce and run in order. The
migration store speaks in namespace-relative keys and knows every storage:

```ts
export const silo = new Silo({
  storages: {
    default: { adapters: [localStorage(), memory()], schema: Schema },
    secure: {
      adapters: [indexedDb({ name: "acme" }), memory()],
      schema: { token: value<string>() },
    },
  },
  migrations: {
    // Asynchronous, because one storage lists an asynchronous adapter.
    2: async (store) => {
      await store.rename("legacyTheme", "theme");
      await store.move("token", { to: "secure" });
    },
  },
});
```

Each successful step saves its version, so the next start skips completed
steps. Concurrent stores can still run the same migration; steps must tolerate
reruns. When the default storage is synchronous and the stored
version is current, the gate opens inside the constructor and the first
frame is kept. See [migrations](migrations.md).

## A store per request on the server

A `Silo` holds per-key snapshots, so on a server it belongs to one request.
Construct it when the request starts, over the Redis the process already
connected, and dispose it when the response is sent:

```ts
import Redis from "ioredis";
import { Silo, value } from "@priemskiyyy/silo";
import { redis } from "@priemskiyyy/silo-redis";

const client = new Redis(process.env.REDIS_URL);

const Schema = { locale: value({ fallback: "en" }) };

export const handle = async (request: Request) => {
  const silo = new Silo({
    storages: {
      default: {
        adapters: [redis({ client, match: "silo:*" })],
        schema: Schema,
      },
    },
  });

  try {
    const locale = silo.scope(`users:${userOf(request)}`).value("locale");

    await locale.hydrated();
    return new Response(render(locale.get()));
  } finally {
    try {
      await silo.flush();
    } finally {
      silo.dispose();
    }
  }
};
```

`match` filters the keys returned to the migration. The Redis adapter still
uses `KEYS`, which scans the keyspace; a namespace filter does not remove that
server-side cost. The client outlives every store; `dispose()` releases
nothing it did not open. See [server rendering](server-rendering.md).
