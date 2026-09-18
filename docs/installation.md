---
description: "Install the Silo core, a framework binding, the devtools and any of the twenty-three storage adapters: package matrix, factory names and peer requirements."
---

# Installation

Install the core, the adapters you need, and an optional framework binding.
Packages use ESM and include TypeScript declarations. SDK adapters accept a
client created by your application; install that SDK separately.

## Frameworks

| Application                    | Packages                                     | Peer requirement                     |
| ------------------------------ | -------------------------------------------- | ------------------------------------ |
| Plain JavaScript or TypeScript | `@priemskiyyy/silo` plus adapters            | None                                 |
| React                          | `@priemskiyyy/silo @priemskiyyy/silo-react`  | React `>=19.2 <20`                   |
| Vue                            | `@priemskiyyy/silo @priemskiyyy/silo-vue`    | Vue `>=3.5 <4`                       |
| Solid                          | `@priemskiyyy/silo @priemskiyyy/silo-solid`  | Solid `>=1.9 <2`                     |
| Svelte                         | `@priemskiyyy/silo @priemskiyyy/silo-svelte` | Svelte `>=5.7 <6`                    |
| Expo or React Native           | `@priemskiyyy/silo @priemskiyyy/silo-react`  | React `>=19.2 <20`, a native adapter |

One binding per application, and one store per application. The core does not
depend on a UI framework. See [React](react.md), [Vue](vue.md),
[Solid](solid.md) and [Svelte](svelte.md) for each binding's own API. Svelte
packages are compiled by your application's Svelte toolchain.

## Adapters

Add `@priemskiyyy/silo` alongside the packages below if it is not installed
already. Add `@priemskiyyy/silo-memory` as a fallback if session-only state is
acceptable when a storage availability check fails. It does not provide runtime
failover after a backend has been selected.

### Browser

| Backend           | Package                             | Factory          | Mode  |
| ----------------- | ----------------------------------- | ---------------- | ----- |
| In-process `Map`  | `@priemskiyyy/silo-memory`          | `memory`         | sync  |
| `localStorage`    | `@priemskiyyy/silo-local-storage`   | `localStorage`   | sync  |
| `sessionStorage`  | `@priemskiyyy/silo-session-storage` | `sessionStorage` | sync  |
| IndexedDB         | `@priemskiyyy/silo-indexeddb`       | `indexedDb`      | async |
| `document.cookie` | `@priemskiyyy/silo-cookie`          | `cookie`         | sync  |
| URL search params | `@priemskiyyy/silo-search-params`   | `searchParams`   | sync  |
| `chrome.storage`  | `@priemskiyyy/silo-chrome-storage`  | `chromeStorage`  | async |

### React Native, Expo and Capacitor

| Backend               | Package                                   | Factory                | Mode  | Install alongside                           |
| --------------------- | ----------------------------------------- | ---------------------- | ----- | ------------------------------------------- |
| MMKV                  | `@priemskiyyy/silo-mmkv`                  | `mmkv`                 | sync  | `react-native-mmkv`                         |
| AsyncStorage          | `@priemskiyyy/silo-async-storage`         | `asyncStorage`         | async | `@react-native-async-storage/async-storage` |
| Expo SecureStore      | `@priemskiyyy/silo-expo-secure-store`     | `secureStore`          | async | `expo-secure-store`                         |
| react-native-keychain | `@priemskiyyy/silo-react-native-keychain` | `keychain`             | async | `react-native-keychain`                     |
| Capacitor Preferences | `@priemskiyyy/silo-capacitor-preferences` | `capacitorPreferences` | async | `@capacitor/preferences`                    |
| iCloud key-value      | `@priemskiyyy/silo-icloud`                | `icloud`               | async | `react-native-cloud-store`                  |

The iCloud adapter is experimental and iOS only: gate it with
`available: () => Platform.OS === "ios"` and list another adapter after it.

### Desktop and Node

| Backend        | Package                            | Factory         | Mode  | Install alongside                               |
| -------------- | ---------------------------------- | --------------- | ----- | ----------------------------------------------- |
| JSON file      | `@priemskiyyy/silo-json-file`      | `jsonFile`      | sync  | None                                            |
| SQLite         | `@priemskiyyy/silo-sqlite`         | `sqlite`        | sync  | `node:sqlite`, `better-sqlite3` or `bun:sqlite` |
| electron-store | `@priemskiyyy/silo-electron-store` | `electronStore` | sync  | `electron-store` or `conf`                      |
| Tauri store    | `@priemskiyyy/silo-tauri-store`    | `tauriStore`    | async | `@tauri-apps/plugin-store`                      |

### Server and edge

| Backend                    | Package                                        | Factory                          | Mode  | Install alongside        |
| -------------------------- | ---------------------------------------------- | -------------------------------- | ----- | ------------------------ |
| Redis                      | `@priemskiyyy/silo-redis`                      | `redis`                          | async | `redis` or `ioredis`     |
| unstorage                  | `@priemskiyyy/silo-unstorage`                  | `unstorage`                      | async | `unstorage` and a driver |
| Cloudflare Workers KV      | `@priemskiyyy/silo-cloudflare-kv`              | `cloudflareKv`                   | async | None                     |
| Cloudflare Durable Objects | `@priemskiyyy/silo-cloudflare-durable-objects` | `cloudflareDurableObjectStorage` | async | None                     |

### Remote and realtime

| Backend                   | Package                       | Factory     | Mode    | Install alongside                                |
| ------------------------- | ----------------------------- | ----------- | ------- | ------------------------------------------------ |
| REST key-value over fetch | `@priemskiyyy/silo-http`      | `http`      | async   | None                                             |
| Simulcast bridge          | `@priemskiyyy/silo-simulcast` | `simulcast` | wrapped | `@priemskiyyy/simulcast` and one of its adapters |

The bridge wraps any other adapter and delivers the changes made on other
devices over a [simulcast](https://priemskiyyy.github.io/simulcast/) channel.

For example, React with `localStorage` and the memory fallback:

::: code-group

```sh [npm]
npm install @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```sh [pnpm]
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```sh [yarn]
yarn add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

```sh [bun]
bun add @priemskiyyy/silo @priemskiyyy/silo-react @priemskiyyy/silo-local-storage @priemskiyyy/silo-memory
```

:::

[Choose an adapter](adapters.md) explains each mapping, its options and its
traps. A shared contract does not make backends interchangeable at the medium
level: what survives a round trip, how much fits, and whether another tab or
device can be observed stay with the backend.

## Optional packages

```sh
pnpm add -D @priemskiyyy/silo-devtools
```

- [Devtools](devtools.md) mounts a browser inspector over `silo.diagnostics`.
  The React wrapper is a separate import, `@priemskiyyy/silo-devtools/react`,
  and the package root works without a framework. Do not mount it in React
  Native.
- [Application testing](testing.md) uses `@priemskiyyy/silo/mock`, included in
  the core.
- [Adapter conformance](testing-adapters.md) uses `@priemskiyyy/silo/testing`,
  also included in the core. It needs Vitest `>=3`, an optional peer that only
  the file running the suite imports.

## Validation

A key without a codec or a schema trusts whatever is on disk. To validate stored
data at the boundary, pass any [Standard Schema](https://standardschema.dev)
validator to `value({ schema })`:

```sh
pnpm add zod
```

Valibot and ArkType work the same way, with no runtime dependency on any of
them. See [schema and codecs](schema-and-codecs.md).

## Runtime requirements

- ESM only. There is no CommonJS build.
- TypeScript with `strict` on and `moduleResolution` set to `bundler` or
  `node16`. The published declarations are built and verified with TypeScript
  5.8 against a packed consumer at `skipLibCheck: false`.
- The memory adapter uses `structuredClone`, present in every browser Silo
  targets and in Node 17 and newer.
- The browser adapters resolve their platform lazily, so importing them on a
  server is safe: `available()` answers `false`, and a store constructed there
  can select another candidate. See [server rendering](server-rendering.md).
- The IndexedDB adapter needs a browser. Under Vitest, `fake-indexeddb/auto` in
  a setup file is enough.
- The SQLite adapter needs a synchronous statement API. `node:sqlite` ships
  with Node 22.13 and newer and needs no package; `better-sqlite3` and
  `bun:sqlite` share the same statement API.

Developing this repository needs Node `>=22.18` and the pnpm version pinned in
`package.json`. That is separate from what the published packages require.
