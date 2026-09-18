---
description: "Silo recipes: per-user scopes, query state in the URL, secure tokens, a live remote value over http and simulcast, no-flash themes, consent gating, migrations."
---

# Recipes

Choose a task below. Each recipe names the lifecycle or failure behavior that
matters for that use case.

| Task                                             | Recipe                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Mix app, workspace, and user state in one screen | [Workspace and user preferences](#workspace-and-user-preferences)                           |
| Preserve `key.workspaceId.data` and user keys    | [Existing workspace and user keys](#existing-workspace-and-user-keys)                       |
| Show a save result and retry a failed write      | [Save a draft and retry](#save-a-draft-and-retry)                                           |
| Try opening IndexedDB before choosing storage    | [Check IndexedDB before startup](#check-indexeddb-before-startup)                           |
| Share filters through a link                     | [Shareable state in the URL](#shareable-state-in-the-url)                                   |
| Keep authentication data in device storage       | [A secure token beside plain preferences](#a-secure-token-beside-plain-preferences)         |
| Receive remote changes                           | [A remote value that updates on every device](#a-remote-value-that-updates-on-every-device) |
| Rename existing physical keys                    | [Mapped-key migrations](migrations.md#change-a-legacy-physical-key)                         |

## Workspace and user preferences

Use explicit handles when one component reads several scopes. This browser React
example keeps the theme global, a draft per workspace, and the locale per user:

```tsx
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { useValue } from "@priemskiyyy/silo-react";
import { z } from "zod";

const ThemeSchema = z.enum(["light", "dark"]);
const LocaleSchema = z.enum(["en", "de"]);

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage()],
      schema: {
        theme: value({ schema: ThemeSchema, fallback: "light" }),
        draft: value({ schema: z.string(), fallback: "" }),
        locale: value({ schema: LocaleSchema, fallback: "en" }),
      },
    },
  },
});

const Preferences = ({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) => {
  const workspace = silo
    .scope("workspaces")
    .scope(encodeURIComponent(workspaceId));
  const user = silo.scope("users").scope(encodeURIComponent(userId));
  const [theme] = useValue(silo.value("theme"));
  const [draft, setDraft] = useValue(workspace.value("draft"));
  const [locale, setLocale] = useValue(user.value("locale"));

  return (
    <section data-theme={theme}>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <select
        value={locale}
        onChange={(event) => setLocale(LocaleSchema.parse(event.target.value))}
      >
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </select>
    </section>
  );
};

export const WorkspacePage = ({
  workspaceId,
  userId,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
}) => {
  if (!workspaceId || !userId) {
    return <p>Select a workspace and sign in.</p>;
  }

  return <Preferences workspaceId={workspaceId} userId={userId} />;
};
```

For workspace `7` and user `2`, the keys are `silo:theme`,
`silo:workspaces:7:draft`, and `silo:users:2:locale`. To make a preference specific
to both identities, nest a user scope under the workspace. See the next example.
All three hooks work together without a provider. A scope changes the key path;
it does not inherit values from the global scope. Each missing value uses its
declared fallback.
Encode IDs consistently; `:` is scope path syntax, not an opaque ID character.

After the workspace's consumers have unmounted, free its cached records:

```ts
await silo.scope("workspaces").scope(encodeURIComponent(workspaceId)).release();
```

Stored data remains available when the workspace opens again. User records have
an independent lifetime in this example. [Scopes](scopes.md) explains release
and deletion; [key mappings](storages.md#existing-storage-keys) preserve a legacy
layout without changing the component.

## Existing workspace and user keys

An application may already store workspace data as `key.<workspaceId>.data`
and user preferences as `user.<userId>.locale`. Keep those physical keys with
one reversible mapping. IDs come from the scope of each handle; changing the
active workspace does not reconfigure the store.

This browser example supports several workspaces and users at once:

```ts [silo.ts]
import { Silo, value } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { z } from "zod";
import { keys } from "./keys";

const ThemeSchema = z.enum(["light", "dark"]);
const LocaleSchema = z.enum(["en", "de"]);

const AppSchema = {
  theme: value({ schema: ThemeSchema, fallback: "light" }),
};
const WorkspaceSchema = {
  draft: value({ schema: z.string(), fallback: "" }),
  sidebarCollapsed: value({ schema: z.boolean(), fallback: false }),
};
const UserSchema = {
  locale: value({ schema: LocaleSchema, fallback: "en" }),
};

export const silo = new Silo({
  namespace: "app",
  storages: {
    default: {
      adapters: [localStorage()],
      keys,
      schema: { ...AppSchema, ...WorkspaceSchema, ...UserSchema },
    },
  },
});

const encodeId = (id: string) => {
  if (id.length === 0) {
    throw new Error("An identity is required before acquiring scoped values.");
  }
  return encodeURIComponent(id).replaceAll(".", "%2E");
};

export const workspace = (workspaceId: string) =>
  silo.scope("workspaces").scope(encodeId(workspaceId));
export const user = (userId: string) =>
  silo.scope("users").scope(encodeId(userId));
export const workspaceUser = (workspaceId: string, userId: string) =>
  workspace(workspaceId).scope("users").scope(encodeId(userId));

silo.value("theme").set("dark");
workspace("7").value("draft").set("First workspace draft");
workspace("8").value("draft").set("Second workspace draft");
user("2").value("locale").set("de");
workspaceUser("7", "2").value("sidebarCollapsed").set(true);
await silo.flush();
```

The mapping is separate from the values and scope helpers:

::: details keys.ts: preserve the existing physical keys

```ts
import type { Storages } from "@priemskiyyy/silo";

export const keys = {
  encode: (logical: string) => {
    const member =
      /^app:workspaces:([^:]+):users:([^:]+):sidebarCollapsed$/.exec(logical);
    if (member !== null) {
      return `key.${member[1]}.sidebar.${member[2]}`;
    }
    const workspace = /^app:workspaces:([^:]+):draft$/.exec(logical);
    if (workspace !== null) {
      return `key.${workspace[1]}.data`;
    }
    const user = /^app:users:([^:]+):locale$/.exec(logical);
    if (user !== null) {
      return `user.${user[1]}.locale`;
    }
    return logical;
  },
  decode: (physical: string) => {
    const member = /^key\.([^.]+)\.sidebar\.([^.]+)$/.exec(physical);
    if (member !== null) {
      return `app:workspaces:${member[1]}:users:${member[2]}:sidebarCollapsed`;
    }
    const workspace = /^key\.([^.]+)\.data$/.exec(physical);
    if (workspace !== null) {
      return `app:workspaces:${workspace[1]}:draft`;
    }
    const user = /^user\.([^.]+)\.locale$/.exec(physical);
    if (user !== null) {
      return `app:users:${user[1]}:locale`;
    }
    if (physical.startsWith("app:")) {
      return physical;
    }
    return undefined;
  },
} satisfies NonNullable<Storages["default"]["keys"]>;
```

:::

| Handle                                              | Physical key      |
| --------------------------------------------------- | ----------------- |
| `silo.value("theme")`                               | `app:theme`       |
| `workspace("7").value("draft")`                     | `key.7.data`      |
| `workspace("8").value("draft")`                     | `key.8.data`      |
| `user("2").value("locale")`                         | `user.2.locale`   |
| `workspaceUser("7", "2").value("sidebarCollapsed")` | `key.7.sidebar.2` |

A screen can call `useValue(workspace(workspaceId).value("draft"))` alongside
`useValue(user(userId).value("locale"))`. The user preference is shared between
workspaces; the sidebar preference belongs to both identities. Mount the screen
only after both IDs are known, as in the previous recipe.

Once all consumers of workspace `7` have unmounted, call
`await workspace("7").release()`. That also releases its workspace-user records.
Workspace `8` and the independent user preferences remain active. Stored data
is not deleted. Release a user's separate scope when its consumers finish too.

The mapping leaves `app::version` unchanged. Migrations enumerate logical keys
such as `workspaces:7:draft` through `store.keys()`, so migration code does not
need to parse `key.7.data`. Keep both directions stable across releases; see
[mapped-key migrations](migrations.md#change-a-legacy-physical-key).

The ID encoding escapes dots and colons used as separators. Numeric IDs and UUIDs
keep their existing spelling. If legacy IDs used a different escape convention,
match that convention in both directions before adopting this example. Scopes
organize keys; they do not enforce authorization or isolate browser data between
signed-in users.

## Save a draft and retry

Silo updates the snapshot immediately and starts persistence on every edit.
Use `flush()` to show a confirmed save result. A failed write can be retried by
setting the current value again:

```tsx
import { useState } from "react";
import { Silo, value } from "@priemskiyyy/silo";
import type { SiloValue } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { useValue } from "@priemskiyyy/silo-react";

const silo = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: "notes" })],
      schema: { draft: value({ fallback: "" }) },
    },
  },
});

export const DraftEditor = ({ handle }: { handle: SiloValue<string> }) => {
  const [draft, setDraft] = useValue(handle);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );

  const handleSave = async () => {
    setSave("saving");
    try {
      handle.set(handle.get());
      await handle.flush();
      setSave("saved");
    } catch {
      setSave("failed");
    }
  };

  return (
    <>
      <textarea
        value={draft}
        disabled={save === "saving"}
        onChange={(event) => {
          setDraft(event.target.value);
          setSave("idle");
        }}
      />
      <button onClick={handleSave} disabled={save === "saving"}>
        {save === "failed" ? "Retry save" : "Save"}
      </button>
      <p role="status">
        {save === "saved"
          ? "Saved"
          : save === "failed"
            ? "Could not save. Your edit is still here."
            : ""}
      </p>
    </>
  );
};

export const EditorPage = () => <DraftEditor handle={silo.value("draft")} />;
```

This confirms the adapter accepted the write. It does not promise that a browser
will never evict data. For a loading placeholder or a read error, also observe
`useValueStatus(handle)` as in [Getting started](getting-started.md).

## Check IndexedDB before startup

Candidate initialization is synchronous. If the application
should use memory when opening IndexedDB fails, open it before constructing Silo:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { memory } from "@priemskiyyy/silo-memory";

const openStorage = async () => {
  const persistent = indexedDb({ name: "notes" });
  try {
    await persistent.native.database();
    return persistent;
  } catch (cause) {
    persistent.dispose();
    console.warn(
      "IndexedDB could not open; this session will not persist",
      cause,
    );
    return memory();
  }
};

export const createSilo = async () => {
  const adapter = await openStorage();
  return new Silo({
    storages: {
      default: {
        adapters: [adapter],
        schema: { draft: value({ fallback: "" }) },
      },
    },
  });
};
```

Await `createSilo()` in application startup, before mounting consumers. The chosen
adapter is then used for both migrations and values. No data is transferred
between backends, and later failures still report through status.

Opening successfully does not test write permissions or quota. An IndexedDB open
blocked by another connection remains pending; this example has no timeout.
If a startup deadline is required, handle it in the application and dispose the
unused adapter so a late connection is closed.

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

See [scopes](scopes.md) for the difference between clearing data and releasing records.

## Shareable state in the URL

Filters, sorting and a search query belong in the address bar, so a link
carries them. Keep them in a storage over `searchParams()`, with a plain text
format so the link reads `?filter=starred` rather than
`?filter=%22starred%22`, and validate each parameter with a Standard Schema
so a hand-edited value cannot reach the application:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import type { TextFormat } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";
import { z } from "zod";

const plainText: TextFormat = {
  stringify: (value) => (value === undefined ? undefined : String(value)),
  parse: (text) => text,
};

const FilterSchema = z.enum(["all", "today", "starred"]);
const PageSchema = z.coerce.number().int().positive();

export const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    url: {
      adapters: [searchParams({ format: plainText }), memory()],
      schema: {
        filter: value({ schema: FilterSchema, fallback: "all" }),
        page: value({ schema: PageSchema, fallback: 1 }),
        query: value({ schema: z.string(), fallback: "" }),
      },
    },
  },
});

silo.value("url.filter").set("starred"); // the address bar now reads ?filter=starred
```

`PageSchema` converts URL text to a positive integer. The format writes it back
as plain text, so no custom number codec is needed.

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
import { z } from "zod";

const realtime = new RealtimeClient({ adapter: ably({ client: ablyClient }) });
realtime.connect();

const SettingsSchema = z.object({
  locale: z.string(),
  digest: z.boolean(),
});

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
      schema: { settings: value({ schema: SettingsSchema }) },
    },
  },
});

const settings = silo.value("remote.settings");

settings.subscribe(() => render(settings.get())); // rerenders when any device writes
```

The server stores the value on `PUT` and publishes `{ key, value }` on the
channel, once for every client. Without a server in the loop, pass `publish`
and the bridge announces this device's own writes after each write completes. The
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
`namespace: "fieldbook"`. Keep this script's decoding rules consistent with the schema and adapter format.
For server-rendered preferences, the application can also read a cookie from
the request header. See [server rendering](server-rendering.md).

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

Check consent when constructing the store. This example uses memory when consent
is absent and checks localStorage availability when it is granted:

```ts
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";

const createSilo = (consent: { granted: boolean }) =>
  new Silo({
    storages: {
      default: {
        adapters: consent.granted ? [localStorage(), memory()] : [memory()],
        schema: Schema,
      },
    },
  });
```

The choice is made once, so construct a new store when consent changes and
hand it to the provider; the hooks follow the new `silo` prop. The
[Fieldbook example](examples.md) rebuilds its store the same way when the
Lab simulates unavailable storage. Replacing the store does not copy its memory
values into the new backend. Transfer them explicitly if needed, and flush the
old store before disposal if it has writes you want to keep.

## Store dates and collections in text storage

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

Silo saves a version after each successful callback. Failed checkpoint writes,
interruptions, and concurrent startup can repeat callbacks, so steps must tolerate
reruns. A current version on a synchronous default storage allows reads to begin
during construction. See [migrations](migrations.md).

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
server-side cost. The client outlives every store; `dispose()` does not close that shared client. See [server rendering](server-rendering.md).
