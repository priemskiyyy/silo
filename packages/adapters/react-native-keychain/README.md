<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-react-native-keychain

Store [Silo](../../core) values through react-native-keychain. The application supplies the SDK and platform options.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-react-native-keychain @priemskiyyy/silo-mmkv @priemskiyyy/silo-memory react-native-keychain react-native-mmkv@3
```

## Create a silo

This example uses the MMKV v3 API supported by the [MMKV adapter](../mmkv).

```ts
import * as Keychain from "react-native-keychain";
import { MMKV } from "react-native-mmkv";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { mmkv } from "@priemskiyyy/silo-mmkv";
import { keychain } from "@priemskiyyy/silo-react-native-keychain";

const silo = new Silo({
  storages: {
    default: {
      adapters: [mmkv({ storage: new MMKV() }), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    secure: {
      adapters: [keychain({ keychain: Keychain }), memory()],
      schema: { token: value<string>() },
    },
  },
});

const token = silo.value("secure.token");

token.set("eyJ...");
await token.flush();
```

Keys of a storage other than `default` are addressed as `storage.key`. Pass `options` to forward keychain options to every call, for biometrics or a specific accessibility level, and `service.prefix` to change how the service names the adapter writes start:

```ts
keychain({
  keychain: Keychain,
  service: { prefix: "acme." },
  options: {
    accessControl: "BiometryCurrentSet",
    authenticationPrompt: { title: "Unlock your session" },
  },
});
```

## Options

| Option      | Default               | Meaning                                                                                                                    |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `keychain`  | required              | The `react-native-keychain` module.                                                                                        |
| `service`   | `{ prefix: "silo." }` | Every entry is one service named `${prefix}${encoded key}`.                                                                |
| `options`   | none                  | `accessible`, `accessControl` and `authenticationPrompt`, forwarded to every call.                                         |
| `available` | `() => true`          | Overrides the synchronous availability check.                                                                              |
| `format`    | `JSON`                | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Values are stored as text, JSON by default; `undefined` is a removal, and a stored password that will not parse is reported as a hydrate error on the value's status. Pass `format` (`superjson`, `devalue`, anything with `stringify` and `parse`) to change the text; changing it over existing data is a migration.
- `available` defaults to always available. Pass a function to gate this candidate by application state at construction, so the next adapter in the list is chosen instead.
- The keychain addresses entries by service, so every silo key is one entry under `silo.<key encoded as base64url>`, with the plain key kept as the entry's username. The encoding is what lets `:` and a scope segment reach the Android keystore.
- `keys` lists the services under the prefix, so a migration can enumerate this storage. Entries written by other libraries are not listed.
- The module answers `false` instead of throwing when the platform refuses a write; the adapter turns that into a write error on the value's status.
- iOS keychain items survive an uninstall. Remove what must not, through `remove` or a migration, before relying on a fresh install.
- Nothing reports a change from outside the adapter, so there is no `observe`. `dispose` leaves the underlying data and client intact.
- The key encoder uses `TextEncoder`, which Hermes ships since React Native 0.74. Hermes has no `TextDecoder`, so `keys` decodes service names without one, and a name whose bytes are not UTF-8 is skipped as foreign.

## License

[MIT](LICENSE)
