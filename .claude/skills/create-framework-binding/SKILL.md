---
name: create-framework-binding
description: Add a Silo binding for a UI framework. Use when asked to support a new framework, renderer, or reactivity system in Silo, or to wire Silo into an application's own store primitive.
---

# Create a Silo framework binding

A binding adapts Silo's reactivity to one framework's and holds almost no logic
of its own. The core owns keys, storages, codecs, snapshots, demand, write
ordering, hydration and migrations. The binding subscribes, reads and
rerenders. If a binding needs a new rule about persistence, the rule belongs in
the core.

The Vue, Solid and Svelte bindings under `packages/vue`, `packages/solid` and
`packages/svelte` are being written in a parallel session. Do not edit them
unless asked to; treat `packages/react` as the reference.

## 1. Read before writing

1. `packages/react/src/`: the reference binding, and the shortest complete
   answer to what a binding consists of. A context and a provider under
   `context/`, one internal hook over `ObservableValue` under
   `hooks/internal/`, one hook per public read under `hooks/`, a `Register`
   type under `types/`, and a barrel. Nothing else.
2. `docs/react.md` and `docs/server-rendering.md`: the behavior a consumer is
   promised, including what renders on a server.
3. `packages/devtools/src/react.ts`: the devtools wrapper convention. The
   inspector is a framework-independent class; each framework gets a wrapper
   that reads the provider's store and mounts it.
4. The framework: its external-store primitive, whether snapshots must be
   referentially stable between renders, how it renders on a server, how it
   provides context, and where a subscription is torn down.

## 2. Decide the mapping

Write these down in the package README before coding:

- **The store primitive.** `SiloValue` is already an external store:
  `subscribe` takes a listener and returns an unsubscribe, and `get` returns
  the current snapshot. `status`, `silo.status` and `silo.diagnostics` are
  `ObservableValue`s with the same pair. Find the framework's equivalent
  (`useSyncExternalStore`, a readable store, a signal from a subscription) and
  pass the two functions straight through. A binding that copies snapshots
  into framework-owned state instead will tear.
- **Snapshot identity.** `get()` returns the stored reference, decoded once
  when the value arrived, not per read. Do not map, clone or wrap it on the way
  out: a fresh identity per render is an infinite loop in every external-store
  consumer.
- **Demand.** Reading a value creates demand and starts hydration; observing
  its `status` does not. Keep that split in the hook names, and never read a
  value inside a status-only hook to make the code shorter.
- **The provider surface.** `SiloProvider` takes `silo` and an optional
  `scope` segment. Every value hook below reads under that scope, or the root
  when it is omitted. The provider memoizes on the segment, because `scope()`
  builds a fresh handle each call and the store is its own root scope. The
  store owns its own lifetime: mounting and unmounting the provider persists
  nothing and discards nothing.
- **The public reads.** `useSilo` (the store), `useScope` (the provider's
  scope), `useValue(key)` (snapshot plus a setter that accepts a value or an
  updater of the latest snapshot), `useValueStatus(key)`, `useSiloStatus()`
  and `useNativeStorage()` (the native handles by storage name). Each read
  hook takes an optional `onChange` callback that runs on later changes with
  the latest value, typed `(value) => void | Promise<unknown>`, so a
  consumer never has to memoize it. Use the framework's own word for a hook.
- **`Register`.** The one declaration-merging `interface` in the package, the
  exception every house rule allows, plus the aliases that infer everything
  from the registered store: `RegisteredStorages`, `RegisteredSilo`,
  `RegisteredScope`, `RegisteredKey`, `RegisteredValue<TKey>` and
  `RegisteredNativeStorage`. Nothing registered means `Storages`, `string`
  and `unknown`, so the untyped path keeps working.

## 3. Implement

- Package at `packages/<framework>` mirroring `packages/react`: `package.json`,
  `tsconfig.json`, `tsdown.config.ts`, `README.md`, `LICENSE`, `src/index.ts`,
  the context under `src/context/`, hooks under `src/hooks/` (or
  `composables/`, `primitives/`, `utilities/`, whichever the framework says),
  the shared subscription helper under `src/hooks/internal/`, and
  `src/types/Register.ts`.
- One exported arrow function per file, `src/...` imports, and a barrel at the
  package root that lists the public API explicitly.
- Declare the framework and `@priemskiyyy/silo` as peer dependencies at the
  matching minor.
- JSDoc with a short `@example` on every public export, written as a consumer
  would call it.
- Add `packages/devtools/src/<framework>.ts`, a `./<framework>` export in the
  devtools `package.json`, and a scope for the framework's lint plugin in
  `eslint.config.js` if it has one. The wrapper constructs `SiloDevtools`
  once, follows the provider's store with `setSilo`, forwards `maxEvents`
  with `setMaxEvents`, mounts into a host element after mount and unmounts
  on teardown. It renders an empty host on the server.

Do:

- Put the subscription in one internal helper and build every public hook on
  it. The reference binding has exactly one, and every hook is three lines
  over it.
- **Return a stable server snapshot.** A server has no storage, so a value
  reads its declared fallback (`undefined` without one) through the handle's
  own `get`, a value status reads `{ state: "hydrating" }` and the store
  status reads `{ state: "migrating" }`, each a module-level interned
  constant. A fresh object per call makes an external-store consumer loop, and
  the snapshot the client hydrates to must match what the server rendered or
  the first paint tears.
- Unsubscribe where the framework tears down, and let the store outlive the
  component. A binding never calls `dispose()` or `release()` on a store it
  did not create.
- Keep the provider's memo keyed on what actually changes identity: the store
  and the scope segment.
- Wrap function values in an updater in the setter's documentation
  (`setValue(() => fn)`), because a function argument is read as an updater.

Do not:

- Add persistence logic. No caching, no coalescing, no retry, no optimistic
  layer, no cross-component deduplication: all of it already exists once in
  the core, and a second copy per framework is a second set of bugs.
- Read `status` to decide whether to render a value. The snapshot is always
  readable, and `status` is how an error surfaces alongside it.
- Call `set` during render, or read a value in a component that only watches
  status.
- Export a hook per schema key, or generate one. The schema types the key
  parameter already, bare for the default storage and `storage.key` for the
  rest.
- Change `packages/core` because one framework is unusual.

## 4. Test

1. `src/hooks/hooks.test.tsx` (or the framework's convention) with its testing
   library: a value renders its persisted snapshot, a `set` rerenders every
   consumer once, an updater sees the latest snapshot, an external change
   rerenders, `onChange` runs with the latest callback, an unmount
   unsubscribes, a provider `scope` change re-points the hooks, and an error
   status surfaces without losing the snapshot.
2. `src/context/ssr.test.tsx` rendering to a string with no DOM present. It
   asserts the fallback renders, the statuses read `hydrating` and
   `migrating`, nothing throws, and a cold adapter is never opened on a
   server.
3. `src/hooks/hooks.contracts.ts` of type-level assertions: a defaulted key
   reads without `| undefined`, an undefaulted key reads with it, a
   `storage.key` path reaches its storage's schema, an unknown key is
   `@ts-expect-error`, and the registered store's native handles reach the
   native hook.
4. `src/index.test.ts` pinning the barrel's export list.
5. Register the package in `vitest.config.ts` with the environment the
   framework renders in, `dedupe` for any peer the renderer must share a single
   instance of, and a second `-ssr` project on `node` when the server tests
   need it.
6. `docs/<framework>.md`, a row in the README binding table, the framework in
   `docs/installation.md`, and a `CHANGELOG.md` entry.
7. Run `pnpm build && pnpm lint:typescript && pnpm lint:eslint && pnpm lint:prettier && pnpm test:unit && pnpm test:package`.
