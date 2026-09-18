# Expo Fieldbook

A small React Native app for trying Silo on a device. It uses Expo SDK 57,
AsyncStorage, Expo SecureStore, Zod schemas, and Uniwind styling. No account,
server, or credentials are required.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter example-expo dev
```

Open the app in Expo Go for SDK 57. Use `ios`, `android`, or `web` instead of
`dev` to open the corresponding target. The native shortcuts require an
installed simulator or emulator.

## Try it

1. Write an Alpine draft and press **Save now** to confirm it reached storage.
2. Switch to Coast. Its draft is separate. Switch back or restart the app to
   load the saved Alpine draft.
3. Switch between Ada and Grace. They share the workspace draft, but each has
   their own language preference and pinned-workspace setting.
4. Change the theme in **Preferences**. It applies to every user and workspace.
5. Open **Storage**, save a demo token, and restart. On a device, SecureStore
   keeps the token. The web preview uses memory and loses it on reload.
6. Release the workspace cache, then return to **Notebook**. The draft loads
   again from storage; releasing the cache does not delete it.

The identities are local examples, not authentication. Ordinary notes and
preferences use unencrypted AsyncStorage. The fixed demo token uses SecureStore
on iOS and Android; biometric authentication is not enabled.

## Read the code

- `src/silo/silo.ts` declares the storage adapters and Zod schemas.
- `src/screens/NotebookScreen.tsx` reads workspace, user, and workspace-user
  handles in the same component.
- `src/screens/PreferencesScreen.tsx` combines global and user preferences.
- `src/screens/StorageScreen.tsx` shows secure storage and explicit cache release.
- `src/components/ValueFeedback.tsx` retries failed reads with `reload()` and
  failed writes with `set()` followed by `flush()`.

Hooks receive explicit handles, so this example needs neither a provider nor
module augmentation. Values hydrate asynchronously; inputs wait for the initial
read to finish. Every edit starts persistence. **Save now** waits for `flush()`
and reports success or failure.

The app keeps one store alive across screens. It also attempts to flush when
backgrounded, but the operating system may suspend it before that work finishes.
Backgrounding does not dispose the store. The **Release cache** action runs while
notebook consumers are unmounted. Scope release is explicit; it is not tied to
individual hook unmounts.

Metro uses [Expo's monorepo support](https://docs.expo.dev/guides/monorepos/).
SDK runtime dependencies are pinned to Expo's compatible versions. TypeScript
stays at the workspace's 5.8.3 and is excluded from Expo's version suggestion;
the app is checked by the same compiler as the library. The web example is
separate; this app does not import DOM components or browser devtools.

## Verify

```sh
pnpm --filter example-expo check:dependencies
pnpm --filter example-expo lint:typescript
pnpm --filter example-expo build
pnpm --filter example-expo build:native
pnpm exec playwright test -c examples/playwright.config.ts expo.spec.ts
```

The browser tests cover scope isolation, persistence, cache release, and the
web token fallback. Native export checks both iOS and Android bundles. Neither
substitutes for a device test of AsyncStorage and SecureStore.
