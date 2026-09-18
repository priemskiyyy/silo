---
description: "Try Silo in a browser notebook or an Expo app: scoped drafts, global and user preferences, storage recovery, and device SecureStore."
---

<script setup>
// The demo is a separate application, not a page of this site, so these links
// leave the router rather than being handled by it.
import { withBase } from "vitepress";
</script>

# Examples

Two runnable applications use Silo without a backend or credentials:

| Example                           | What to try                                                           |
| --------------------------------- | --------------------------------------------------------------------- |
| Browser Fieldbook                 | Notebook entries, eight storage backends, failed writes, and devtools |
| [Expo Fieldbook](#expo-fieldbook) | Device persistence, workspace and user scopes, and SecureStore        |

Vue, Solid, and Svelte have setup examples in their binding guides.

## Open the live demo

The example is hosted at <a :href="withBase('/demo/')" target="_blank" rel="noreferrer">priemskiyyy.github.io/silo/demo</a>
with no backend, account, or credentials. Start by adding a notebook entry, then
switch notebooks or reload. The storage playground, recovery controls, and
inspector explain what happens underneath.

## Run it without credentials

From a checkout of the repository:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter example-react-web dev
```

Use Node 22.18 or newer and the pnpm version declared in `package.json`. The
source is in `examples/react-web`.

## Explore the browser app

The navigation works on phones and desktops without changing the URL values.

1. **Notebook.** Add entries, write a longer draft, and choose preferences.
   Entries and supplies belong to the selected notebook. Clearing a notebook
   requires confirmation and reports whether removal succeeded.
2. **Storages.** Store a note and count in different backends. Reload or open a
   second tab to compare behavior. Expand the comparison table for details.
3. **Recovery.** Simulate unavailable storage, delayed reads, or a failed write.
   Each control explains what it changes. The server card shows requests made
   by the simulated remote adapter.
4. **Inspect.** Open the devtools launcher to inspect values and the event timeline.

## The eight storages

| Storage                | Adapters                                 | Keys                                            | Why                                                                                                   |
| ---------------------- | ---------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `memory`               | memory                                   | note, count                                     | Session-only fallback; data is lost on reload.                                                        |
| `default` (Local)      | localStorage, memory                     | note, count, theme, density, visits, quietUntil | Synchronous, so the look is right on the first frame.                                                 |
| `session`              | sessionStorage, memory                   | note, count, composer, selectedEntry            | This tab only: a second tab starts empty.                                                             |
| `journal` (IndexedDB)  | IndexedDB, memory                        | note, count, entries, supplies                  | Structured clone: an entry's `Date` and `Set`, and the supplies `Map`, come back as themselves.       |
| `preferences` (Cookie) | cookie, memory                           | note, count, units                              | The one preference a server would want on every request.                                              |
| `url`                  | search params, memory                    | note, count, filter, sort, query                | Shareable: the address bar changes as you type, and a hand-edited value is validated by a Zod schema. |
| `shared` (Synced URL)  | search params, cross-tab sharing, memory | note, count                                     | The fragment, announced to the other tabs on this path, which write it into their own address bars.   |
| `remote`               | http and simulcast, memory               | note, count                                     | A REST key-value server over `fetch`, with a realtime channel announcing each write to other tabs.    |

Every storage keeps the `fieldbook` namespace except the two URL storages,
whose adapter declares a hidden keyspace so a link reads `?note=hello`. The store declares one
migration, version 2, which renames `legacyTheme` to `theme`; "Plant v1 data"
in the Lab puts the old shape back so the next reload runs it.

## The server and the bridge

`src/silo/server/createFakeServer.ts` is a fetch-compatible REST key-value
server: `GET /kv` lists keys, `GET`, `PUT` and `DELETE /kv/:key` read, store and
remove one, and any other route is a 405. Rows live in `localStorage` under a
`server:` prefix, so every tab talks to the same server. It sleeps for the
latency the Server card picks, answers 503 once when asked, and keeps the last
twelve requests newest first.

The Remote storage wraps `http({ url: server.url, fetch: server.fetch })` in
`simulcast({ channel, publish })`: `channel` is a simulcast channel over
`broadcastChannel()`, and `publish` is `server.announce`, which posts each
completed write on the same `BroadcastChannel`. The other tabs receive it through
the bridge's `observe`, so a remote value is live without polling.

## What to explore

1. **Reload with the URL storage selected.** The note comes back from the
   address bar, and a value you edit by hand into something the Zod schema
   rejects reads as the fallback with a hydrate error on its status.
2. **Open two tabs on Remote.** Type in one; the other updates through the
   bridge, and the Server card lists the completed `PUT`.
3. **Refuse a write in the Lab.** The snapshot keeps the optimistic value, the
   status reports `{ phase: "write" }`, and the devtools timeline shows the
   refusal against the record.
4. **Slow the journal down.** The entries hydrate late, the status says so, and
   a write made during hydration wins over the stale read.
5. **Plant v1 data and reload.** The store reports `migrating`, the migration
   renames the key, and the version record in the devtools header advances.
6. **Open the devtools.** Select a record to filter the timeline to it, read its
   physical key, set a value through the store's own API, and watch the write
   counters move.

## Learn from the source

| Concern                               | Implementation                        |
| ------------------------------------- | ------------------------------------- |
| Storages, schema and the migration    | `src/silo/createFieldbookSilo.ts`     |
| Plain text in the URL                 | `src/silo/plainTextFormat.ts`         |
| Journal shape and inferred entry type | `src/silo/Entry.ts`                   |
| The in-page REST server               | `src/silo/server/createFakeServer.ts` |
| The realtime channel                  | `src/silo/realtime.ts`                |
| Faults, latency and refusals          | `src/silo/adapters/`                  |
| Components and the four steps         | `src/components/`                     |
| Pre-paint theme                       | `index.html`                          |

Stored preferences and journal entries use Zod schemas for validation and type
inference. URL counts use `z.coerce.number().int()` to read text as numbers.

The example uses exhaustive matching
with ts-pattern, CVA variants, `clsx` class composition, and Tailwind.

## Check the example

```sh
pnpm test:examples
```

This builds the packages and the example and runs the Playwright spec in
`examples/fieldbook.spec.ts` against the built app at phone and desktop widths,
including the pre-paint theme, the remote round trip across two pages, and the
devtools listing a refused write.

## Expo Fieldbook

The Expo app uses AsyncStorage for notes and preferences, and Expo SecureStore
for a per-user demo token on iOS and Android. Its web preview uses memory for
the token and says so on screen.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter example-expo dev
```

Open it in Expo Go for SDK 57, or run `pnpm --filter example-expo ios`, `android`,
or `web`. Native shortcuts require a simulator or emulator.

The app demonstrates four scopes in one store:

| Value                   | Scope                          |
| ----------------------- | ------------------------------ |
| Theme                   | Global                         |
| Draft                   | Workspace                      |
| Language and demo token | User, shared across workspaces |
| Pinned workspace        | User within a workspace        |

Switch between workspaces and demo users, save a draft, and restart. The
**Storage** screen also demonstrates `scope.release()`: it frees cached values
while keeping saved data. The next visit hydrates fresh handles.

Source and setup details are in
[the Expo README](https://github.com/priemskiyyy/silo/tree/main/examples/expo).
The identities are local examples, not authentication. The browser tests cover
the web preview; validate SecureStore on a device before relying on it in an app.
