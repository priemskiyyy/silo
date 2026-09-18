---
description: "Where Silo adapters are tested: contract suites, real browser tests, filesystem and SQLite tests, SDK fakes, and gaps in platform coverage."
---

# Test coverage by backend

Every shipped adapter runs the shared storage contract suite and has tests for
its own behavior. The environment matters: a fake client can check our adapter's
calls without exercising a device, service, or its permissions.

This page describes the tests in the repository. It is not a claim that every
supported SDK version or device has been tested.

## Verification matrix

| Adapter                    | Contract and unit environment             | Additional integration coverage in this repository                                                              |
| -------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| memory                     | Real JavaScript `Map`                     | Used throughout core and framework tests                                                                        |
| localStorage               | jsdom; synthetic storage events           | Chromium, Firefox, WebKit: reload persistence and cross-tab delivery                                            |
| sessionStorage             | jsdom; synthetic storage events           | Chromium, Firefox, WebKit: reload persistence and tab isolation                                                 |
| IndexedDB                  | `fake-indexeddb`                          | Chromium, Firefox, WebKit: structured values, reloads, transaction timing, and adapter-to-adapter notifications |
| cookie                     | jsdom                                     | Fieldbook browser tests exercise storing and reloading values                                                   |
| searchParams               | jsdom                                     | Fieldbook browser tests exercise URL filters and cross-tab URL sharing                                          |
| chrome-storage             | Fake storage area and events              | No browser-extension installation tests                                                                         |
| MMKV                       | Fake native store                         | No device tests                                                                                                 |
| AsyncStorage               | Fake SDK                                  | No device tests                                                                                                 |
| Expo SecureStore           | Fake SDK                                  | No device or biometric-prompt tests                                                                             |
| react-native-keychain      | Fake SDK                                  | No device or keychain-permission tests                                                                          |
| Capacitor Preferences      | Fake plugin                               | No installed application tests                                                                                  |
| iCloud                     | Fake native module and notifications      | No device, account, or iCloud synchronization tests                                                             |
| JSON file                  | Real temporary files through Node         | Filesystem behavior is exercised locally                                                                        |
| SQLite                     | Real `node:sqlite` in-memory database     | No separate Bun or better-sqlite3 driver run                                                                    |
| electron-store             | Fake store and change events              | No Electron process tests                                                                                       |
| Tauri store                | Fake plugin and events                    | No Tauri application tests                                                                                      |
| Redis                      | Fake client                               | No Redis service tests                                                                                          |
| Cloudflare KV              | Fake namespace                            | No deployed Worker tests                                                                                        |
| Cloudflare Durable Objects | Fake storage                              | No deployed Durable Object tests                                                                                |
| unstorage                  | Real library with its memory driver       | Other drivers are not exercised                                                                                 |
| HTTP                       | Simulated server supplied as `fetch`      | Fieldbook uses an in-page server; no external HTTP service tests                                                |
| Simulcast                  | Fake channel and sync/async mock adapters | Fieldbook exercises browser messaging; no hosted realtime-provider tests                                        |

The IndexedDB Blob case runs on Chromium and Firefox and is skipped on WebKit
in the checked-in browser suite. Other structured-value tests still run there.
The browser suite does not currently fill an origin to force a real quota error;
quota failures are simulated in unit tests and the demo.

## What the checks cover

`pnpm check` builds the packages and example, checks TypeScript, ESLint, and
formatting, then runs unit and garbage-collection tests. Core tests cover write
ordering, interrupted migrations, scope release, expiry, and observation using
a controlled mock adapter.

`pnpm test:browser` runs the dedicated storage fixture in Chromium, Firefox, and
WebKit. `pnpm test:examples` runs the Fieldbook application at phone and desktop
sizes. Browser binaries must be installed first:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:browser
pnpm test:examples
```

`pnpm test:package` installs all packed packages into a separate consumer and
checks their declarations and imports. This catches packaging and public-type
problems, not backend behavior. `pnpm check:release` includes the storage browser
suite, package checks, and documentation checks; run `test:examples` separately
for the Fieldbook interaction suite.

## Test an application on its actual backend

Before depending on a device or service adapter, test the operations your
application uses in that environment. Useful cases include:

- Read a value after a process restart or page reload.
- Reject an open, read, or write through the platform's actual permission model.
- Run an old-data migration, including retry after a saved-data/failed-checkpoint
  interruption.
- Observe a change from a second tab, process, or device if your application
  requires live updates.

The [adapter conformance guide](testing-adapters.md) shows how to run the shared
suite against a real SDK instance. [Application testing](testing.md) covers fast,
deterministic tests with the mock adapter.
