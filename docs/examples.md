---
description: "Run Fieldbook, the Silo showcase: one React store over eight storages, a REST server in the page, a Lab that breaks storage on purpose, and the devtools."
---

<script setup>
// The demo is a separate application, not a page of this site, so these links
// leave the router rather than being handled by it.
import { withBase } from "vitepress";
</script>

# Examples

The repository ships Fieldbook, a field notebook for expeditions and the
showcase for every core guarantee: one store, eight places to keep things, a
server that lives in the page, and a Lab that breaks them on purpose so the
behavior is visible on screen. It is a React application; examples for the
other bindings are not shipped yet.

## Open the live demo

The example is hosted at <a :href="withBase('/demo/')" target="_blank" rel="noreferrer">priemskiyyy.github.io/silo/demo</a>
with no backend, account, or credentials. Pick a storage, type a note, reload,
open a second tab, then open the Silo Devtools launcher in the corner and watch
the records, writes and migrations that produced what you see.

## Run it without credentials

From a checkout of the repository:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter example-react-web dev
```

Use Node 22.18 or newer and the pnpm version declared in `package.json`. The
source is in `examples/react-web`.

## The four steps

The page is a tour, top to bottom, with a numbered nav in the sticky header.

1. **Pick a place.** The same `note` and `count` keys are declared in eight
   storages, and the core keeps eight distinct values. Pick a chip, type,
   count, then reload or open a second tab. The facts beside the field say what
   to expect, and "Compare all eight" opens the whole matrix.
2. **A real notebook on top.** Entries live in IndexedDB under a notebook scope
   such as `notebooks:alpine`, the composer in `sessionStorage`, the supplies
   as a `Map`, and the look in `localStorage` next to a cookie. Switching
   notebooks swaps the keyspace; "Clear this notebook" removes only that one.
   The theme control is the page's one: `index.html` reads the raw value before
   React runs, so a warm start paints the right scheme on its first frame.
3. **Break things.** The Lab rebuilds the store without `localStorage`, slows
   IndexedDB down, refuses a write, corrupts a raw value, and plants version 1
   data for the migration to rename. The Server card beside it is the Remote
   storage's other half: its latency, a 503 on demand, and the http adapter's
   requests as they arrive.
4. **Look inside.** What the devtools launcher in the corner opens, and what to
   look for once you have broken something.

## The eight storages

| Storage                | Adapters                                 | Keys                                            | Why                                                                                                   |
| ---------------------- | ---------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `memory`               | memory                                   | note, count                                     | The floor every other list falls back to. Gone on reload.                                             |
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
landed write on the same `BroadcastChannel`. The other tabs receive it through
the bridge's `observe`, so a remote value is live without polling.

## What to explore

1. **Reload with the URL storage selected.** The note comes back from the
   address bar, and a value you edit by hand into something the Zod schema
   rejects reads as the fallback with a hydrate error on its status.
2. **Open two tabs on Remote.** Type in one; the other updates through the
   bridge, and the Server card lists the `PUT` that landed.
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

| Concern                              | Implementation                                            |
| ------------------------------------ | --------------------------------------------------------- |
| Storages, schema and the migration   | `src/silo/createFieldbookSilo.ts`                         |
| Plain text in the URL, integer codec | `src/silo/plainTextFormat.ts`, `src/silo/integerCodec.ts` |
| The in-page REST server              | `src/silo/server/createFakeServer.ts`                     |
| The realtime channel                 | `src/silo/realtime.ts`                                    |
| Faults, latency and refusals         | `src/silo/adapters/`                                      |
| Components and the four steps        | `src/components/`                                         |
| Pre-paint theme                      | `index.html`                                              |

The example uses Zod schemas as Standard Schema validators, exhaustive matching
with ts-pattern, CVA variants, `clsx` class composition, and Tailwind.

## Check the example

```sh
pnpm test:examples
```

This builds the packages and the example and runs the Playwright spec in
`examples/fieldbook.spec.ts` against the built app at phone and desktop widths,
including the pre-paint theme, the remote round trip across two pages, and the
devtools listing a refused write.
