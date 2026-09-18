# Fieldbook

A field notebook for expeditions, and silo's showcase: one store, eight places
to keep things, a server that lives in the page, and a Lab that breaks them on
purpose so every core guarantee is visible on screen.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter example-react-web dev
```

`pnpm exec playwright test -c examples/playwright.config.ts` runs the spec
against the built app at 375px and 1280px.

## The four steps

The page is a tour, top to bottom, with a numbered nav in the sticky header.

1. **Pick a place.** The same `note` and `count` keys are declared in eight
   storages, and the core keeps eight distinct values. Pick a chip, type,
   count, then reload or open a second tab. The facts beside the field say
   what to expect, and "Compare all eight" opens the whole matrix.
2. **A real notebook on top.** Entries live in IndexedDB under a notebook
   scope (`notebooks:alpine`), the composer in sessionStorage, the supplies as
   a `Map`, and the look in localStorage next to a cookie. Switching notebooks
   swaps the keyspace; "Clear this notebook" removes only that one. The theme
   here is the page's one theme control: `index.html` reads the raw before
   React runs, so a warm start paints the right scheme on its first frame.
3. **Break things.** The Lab rebuilds the store without localStorage, slows
   IndexedDB down, refuses a write, corrupts a raw, plants v1 data. The Server
   card beside it is the Remote storage's other half: its latency, a 503 on
   demand, and the http adapter's requests as they arrive.
4. **Look inside.** What the devtools launcher in the corner opens, and what
   to look for once you have broken something.

| Storage                | Adapters                                 | Keys                                            | Why                                                                                                    |
| ---------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `memory`               | memory                                   | note, count                                     | The floor every other list falls back to. Gone on reload.                                              |
| `default` (Local)      | localStorage, memory                     | note, count, theme, density, visits, quietUntil | Synchronous, so the look is right on the first frame.                                                  |
| `session`              | sessionStorage, memory                   | note, count, composer, selectedEntry            | This tab only: a second tab starts empty.                                                              |
| `journal` (IndexedDB)  | IndexedDB, memory                        | note, count, entries, supplies                  | Structured clone: an entry's `Date` and `Set`, and the supplies `Map`, come back as themselves.        |
| `preferences` (Cookie) | cookie, memory                           | note, count, units                              | The one preference a server would want on every request.                                               |
| `url`                  | search params, memory                    | note, count, filter, sort, query                | Shareable: the address bar changes as you type, and a hand-edited value is validated by a Zod schema.  |
| `shared` (Synced URL)  | search params, cross-tab sharing, memory | note, count                                     | The fragment, announced to the other tabs on this path, which write it into their own address bars.    |
| `remote`               | http+simulcast, memory                   | note, count                                     | A REST key-value server over `fetch`, with a realtime channel announcing each write to the other tabs. |

## The server and the bridge

`src/silo/server/createFakeServer.ts` is a fetch-compatible REST key-value
server: `GET /kv` lists keys, `GET`, `PUT` and `DELETE /kv/:key` read, store
and remove one, and any other route is a 405. Rows live in `localStorage`
under `server:`, so every tab talks to the same server. It sleeps for the
latency the Server card picks, answers 503 once when asked, and keeps the last
twelve requests newest first.

The Remote storage wraps `http({ url: server.url, fetch: server.fetch })` in
`simulcast({ channel, publish })`: `channel` is a `RealtimeClient` channel over
`broadcastChannel()`, and `publish` is `server.announce`, which posts each
landed write on the same BroadcastChannel. The other tabs receive it through
the bridge's `observe`, so a remote value is live without polling.

## The address bar and the namespace

The store's namespace is `fieldbook`, so every physical key carries it:
`fieldbook:theme` in localStorage, `fieldbook:units` as the cookie's name,
`fieldbook::version` for the migration record. The URL storage carries none,
because the `searchParams` adapter declares that a query string hides the
namespace, so a link reads `?note=hello`, not `?fieldbook%3Anote=hello`. The
medium that wins a candidate list has that say; a storage's own `namespace`
overrides it, and migrations translate per storage, so
`store.move("note", { to: "url" })` still names the key once.

The URL storage also takes `format: plainTextFormat`, which writes strings as
they are instead of as JSON, so the link reads the way a person typed it; every
value then comes back as text. `UrlCountSchema` uses
`z.coerce.number().int()` to convert that text to a number. Preferences and
journal entries also infer their types from Zod schemas, including the entry's
`Date` and `Set` fields preserved by IndexedDB.
