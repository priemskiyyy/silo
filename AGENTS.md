# Agent guide

Silo is a typed, reactive persistence runtime with storage adapters, framework
bindings and devtools. Before changing code, read `CONTRIBUTING.md` for layout
and style, `docs/internals/architecture.md` for the invariants,
`.silo-decisions.md` for the decision log that explains why things are the way
they are, and the tests beside the file you touch.

- The model: one `Silo` per application over named `storages`, each with a
  schema and an ordered candidate list of adapters chosen from at construction.
  Default storage keys are addressed bare, every other as `storage.key`. The
  core composes every physical key from the namespace, the scope segments and
  the key; an adapter's `keyspace` declaration and a storage's own `namespace`
  decide whether the prefix is visible in the medium. Reaching a value with
  `silo.value(key)` starts its hydration; `silo.status`, `flush` and
  `diagnostics` read nothing.
- Adding an adapter: follow `.claude/skills/create-adapter/SKILL.md` and
  `docs/writing-an-adapter.md`. Build on `createStorageAdapter` or
  `createTextStorageAdapter`, and run `testStorageAdapter` from
  `@priemskiyyy/silo/testing`.
- Adding a framework binding: follow
  `.claude/skills/create-framework-binding/SKILL.md`. A binding holds no
  persistence logic; it wraps `ObservableValue` in the framework's external
  store. `packages/vue`, `packages/solid` and `packages/svelte` are being
  written in a parallel session: do not edit them unless asked.
- Devtools: `packages/devtools` renders `silo.diagnostics` in a shadow root
  and is framework independent; `src/react.ts` is the wrapper convention.
  Diagnostics never create demand.
- Integrating Silo in an application: `docs/getting-started.md`, then the
  framework page (`docs/react.md`), `docs/storages.md` and `docs/adapters.md`.
  `examples/react-web` is the showcase and the Playwright spec beside it is
  what the docs promise.
- Style: grouped options, `typeof x === "function"` guards, `type` over
  `interface`, no `enum`, no `switch`, no `any`, no `as` casts, no `void`
  operator, no `&&` as control flow, no `??=`, `||=` or `&&=`,
  `assertUnreachable` at union dispatch, early returns, handlers named
  `handle*`, arrow functions exported one per file, `src/...` imports, JSDoc
  with an example on public exports, comments that say why. No em dashes in
  code, comments or prose.
- Style carve-outs, each with a comment saying why, and nothing wider than
  these: `function` overloads wherever a pair is the only way to resolve a
  type parameter from the presence or shape of an option (`value`,
  `createMockAdapter`, `createTextStorageAdapter`, framework `useValue`, the internal `typedValue`
  bridge in `SiloValues`); method syntax on `Codec`, `ValueDefinition` and
  the adapter shapes, because bivariant method parameters are what make
  `ValueDefinition<unknown>` a usable supertype for the `SiloSchema`
  constraint; a declaration-merging `interface Register` per binding and in
  the example; and one explicit `as NativeOf<TStorages>` in
  `AcquiredStorages`, where enumeration erases the storage-to-native
  relationship. ESLint disables are limited to `Register` and that assertion.
  Shared error helpers live in `utils/common/errors.ts`.
- Docs: every page under `docs/` carries a frontmatter `description`, one
  `h1`, relative `page.md` links and snippets that compile against the current
  API. No em dashes, no agent names, no generated-by footers. Verify with
  `pnpm lint:docs && pnpm build:docs && pnpm verify:docs`.
- Name schema constants in PascalCase, for example `AppSchema` or `UserSchema`;
  keep the public `schema` option lowercase.
- Documentation should start with a small working example, explain observed behavior
  in plain language, and link to advanced details. Avoid slogans and repeated
  implementation rationale. Qualify guarantees with their failure conditions;
  distinguish tests with fakes from real backend integration tests.
- Verify with `pnpm check`. Do not commit, push or publish unless asked, and
  never add an agent attribution trailer or footer anywhere.
