<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-expo-secure-store

[Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) adapter for [silo](../../core): asynchronous, JSON encoded persistence in the iOS keychain and the Android keystore, for the tokens and secrets an application must not keep in plain storage.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-expo-secure-store
npx expo install expo-secure-store
```

## Create a silo

```ts
import * as SecureStore from "expo-secure-store";
import { Silo, value } from "@priemskiyyy/silo";
import { secureStore } from "@priemskiyyy/silo-expo-secure-store";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: { adapters: [memory()], schema: {} },
    secure: {
      adapters: [secureStore({ store: SecureStore }), memory()],
      schema: { token: value<string>() },
    },
  },
});

const token = silo.value("secure.token");

token.set("eyJ...");
await token.flush();
```

Keys of a storage other than `default` are addressed as `storage.key`. Pass `options` to forward SecureStore options to every call, for a dedicated keychain service or a biometric prompt:

```ts
secureStore({
  store: SecureStore,
  options: {
    requireAuthentication: true,
    authenticationPrompt: "Unlock your session",
  },
});
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `store`     | required     | The `expo-secure-store` module.                                                                                            |
| `options`   | none         | `keychainService`, `requireAuthentication` and `authenticationPrompt`, forwarded to every call.                            |
| `available` | `() => true` | Replaces the probe, so a candidate list can be gated by application state at construction.                                 |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- Values are stored as text, JSON by default; pass `format` (`superjson`, `devalue`, anything with `stringify` and `parse`) to change that, and treat changing it over existing data as a migration. Large values can be rejected by the platform; Expo does not impose a fixed size limit. Some older iOS releases rejected values around 2 KiB. Native failures become write errors. See [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).
- `available` defaults to always available. Pass a function to gate this candidate by application state at construction, so the next adapter in the list is chosen instead.
- SecureStore accepts only `[A-Za-z0-9._-]` in a key, so every physical key reaches the module as the unpadded base64url of its UTF-8 bytes. A key written by another library under its own name is not visible through this adapter.
- SecureStore cannot list what it holds, so the adapter has no `keys` and a migration cannot enumerate this storage. `copy`, `move` and `rename` still work on keys a migration names.
- Nothing reports a change from outside the adapter, so there is no `observe`.
- `dispose` releases nothing and deletes nothing: the keychain outlives the adapter.
- The key encoder uses `TextEncoder`, which Hermes ships since React Native 0.74 (Expo SDK 51).

## License

[MIT](LICENSE)
