# Contributing

Use Node 22.18 or newer and the pnpm version in `package.json`. Run `pnpm install --frozen-lockfile`, then `pnpm check` before submitting a change.

## Layout

- `packages/core`: the runtime, the schema and codec contract, the storage and adapter contracts, the two adapter generators, the mock adapter and the conformance suite, published as `@priemskiyyy/silo` with the `./mock` and `./testing` subpaths.
- `packages/react`: the provider and hooks, published as `@priemskiyyy/silo-react`.
- `packages/vue`, `packages/solid` and `packages/svelte`: framework-native providers, reactive value bindings and lifecycle tests.
- `packages/devtools`: the inspector over `silo.diagnostics`, a framework-independent class rendered in a shadow root, with a React wrapper at `./react`.
- `packages/adapters/*`, one package per backend, published as `@priemskiyyy/silo-<name>`:
  - Web: `local-storage`, `session-storage`, `indexeddb`, `cookie`, `search-params`, `chrome-storage`.
  - Device: `mmkv`, `async-storage`, `expo-secure-store`, `react-native-keychain`, `capacitor-preferences`, `icloud`.
  - Desktop and Node: `json-file`, `sqlite`, `electron-store`, `tauri-store`, `unstorage`.
  - Server and edge: `redis`, `http`, `cloudflare-kv`, `cloudflare-durable-objects`.
  - Everywhere: `memory`, the floor every candidate list ends in, and `simulcast`, which wraps any adapter with live change notifications from a realtime channel.
- `examples/react-web`: the browser Fieldbook showcase, with its Playwright spec in `examples/fieldbook.spec.ts`.
- `examples/expo`: the native Fieldbook example, with an Expo web-preview spec in `examples/expo.spec.ts`.
- `tests/browser`: a Playwright fixture over a Vite application, for the guarantees no fake can prove.
- `scripts/*`: the verification scripts behind `pnpm test:package`, `pnpm test:memory`, `pnpm verify:docs`, `pnpm verify:release` and the demo build.
- `.silo-decisions.md`: the decision log. A change that alters a documented decision adds an amendment rather than editing history.

Framework bindings use `hooks/`, `composables/`, `primitives/` or `utilities/` according to the framework. Adapter generators live in `generators/`, runtime owners and helpers in `utils/`, constants in `utils/constants/`, and shared contracts in `types/`. Internal contracts belong in each folder's `internal/` directory, so `utils/internal/` holds the helpers no consumer may import. Package roots export the supported public API explicitly, one export per file.

## Code

Prefer descriptive names, early returns, `type` over `interface`, and exhaustive dispatch closed by `assertUnreachable`. No `enum`, `switch`, `any`, `as` casts, the `void` operator, `&&` as control flow, or the logical assignment operators; a guard clause says what happens when the value is already there. Use `src/...` imports within each package. Keep lifecycle decisions in the owner responsible for cleanup: a record lives until its scope is released or the store is disposed, and `dispose()` is synchronous, void and idempotent everywhere it appears. Avoid introducing a shared abstraction for a single use.

`await scope.release()` flushes and detaches cached records under a prefix. A failed write leaves the records available for recovery. Existing value handles retain their last snapshots and become inactive. Never release a scope while its consumers still need those handles.

The write path must preserve this order: encode, take the revision, persist or install the pending slot, then commit value and status together before notifying. The persistence request and both observable projections are installed before any listener runs, so a listener that writes from inside its own notification always carries a higher mutation and always persists after. Acquiring a value with `silo.value(key)` starts hydration. Existing handle getters and subscriptions do not reload it. Store status, flush and diagnostics do not acquire values.

## Adapters

An adapter maps one backend onto the contract and nothing more. It owns serialization, because a codec owns validation; it receives an opaque key and must never transform it, other than a reversible encoding for a backend that cannot hold the characters. `available()` is required and answers the candidate probe at construction, with an `available` option to override it. A backend that holds strings builds on `createTextStorageAdapter`, which owns JSON on both sides and takes a `format` for anything with `stringify` and `parse`; a backend that keeps structured values builds on `createStorageAdapter`. Both supply idempotent disposal, post-dispose silence and the post-dispose throw. An adapter over a medium the page owns declares `keyspace: { namespace: "hidden" }`, and one where either answer is reasonable exposes a `namespace` option. Every adapter runs the shared conformance suite from `@priemskiyyy/silo/testing` in `src/conformance.test.ts`, passing the value corpus its backend can actually carry; backend-specific behavior gets its own tests next to it. Add behavior tests for changes to serialization, external observation or disposal. Keep JSDoc short and include an example. `.claude/skills/create-adapter/SKILL.md` is the full checklist.

## Testing

`pnpm test:unit` runs one vitest project per package, each with a `src` alias onto its own source. The core, the devtools and most adapters run in `node`; the React binding, the web storage areas, the cookie and the search params adapters run in `jsdom`. The IndexedDB project loads `fake-indexeddb/auto` as a setup file, to emulate IndexedDB in unit tests. Native transaction behavior is covered separately by the browser suite. The web storage projects drive external change with a synthetic `new StorageEvent("storage", { ... })`, because jsdom never dispatches one on its own. Adapters over an SDK test against an in-process fake of the SDK's shape, exported from `src/<name>.fixture.ts`.

Silo needs no Docker, no server and no credentials to run its full suite. Storage is local, so every backend it supports is either in process, faked in process, or in the test runtime.

Fakes cannot prove everything. Run `pnpm exec playwright install chromium firefox webkit` once, then `pnpm test:browser` for the Playwright fixture, which covers the claims that need a real browser: a real IndexedDB, a real cross-tab `storage` event between two pages and transaction timing. Quota errors are simulated in unit tests; the browser suite does not fill an origin to its quota. `pnpm test:examples` builds the example and runs its spec at phone and desktop widths. `pnpm test:package` packs every tarball, installs it into a throwaway consumer and typechecks the public contracts against the emitted declarations. `pnpm check:release` runs everything, including the documentation build.

`pnpm test:memory` checks garbage collection of released records and disposed owners after a build; it also runs in `pnpm check`. `pnpm benchmark:memory 50000 release` measures retained heap with a non-retaining adapter. See [memory ownership](docs/internals/memory.md).

## Documentation

Every page under `docs/` starts with a frontmatter `description`, has one `h1`, links to sibling pages as `page.md`, and shows snippets that compile against the current API. Package READMEs follow the same rules. No em dashes, no agent names and no generated-by footers anywhere in the repository, including commit messages and changelog entries. `pnpm lint:docs && pnpm build:docs && pnpm verify:docs` typechecks the site, builds it with the hosted demo, and checks every page, link and meta tag.
