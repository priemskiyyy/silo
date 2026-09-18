<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-memory

In-memory storage for [Silo](../../core), backed by a Map of structured clones. Use it for tests, temporary state, or an explicit fallback when persistence is optional.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
        user: value<{ name: string }>(),
      },
    },
  },
});

silo.value("theme").set("dark");
silo.value("theme").get(); // "dark"
```

## Options

| Option      | Default      | Meaning                                       |
| ----------- | ------------ | --------------------------------------------- |
| `available` | `() => true` | Overrides the synchronous availability check. |

## Behavior

- Nothing persists: the store lives in the adapter, so it is gone on reload, on `dispose()`, and two `memory()` calls share nothing. Put it last in a candidate list, `[localStorage(), memory()]`, so it is the fallback candidate.
- Values pass through `structuredClone` on write and on read, so a `Date`, a `Map`, a `Set` or a typed array survives, a class instance comes back as a plain object, and a value the clone refuses, such as a function, fails the write. None of that is portable to the JSON adapters.
- `native` is the `Map` itself, identity stable, so a test can seed it before hydration or assert against it after. Reading it bypasses the clone.
- `keys` lists the `Map`. Nothing changes an in-process `Map` from outside, so there is no `observe`; `createMockAdapter` from `@priemskiyyy/silo/mock` drives that path in tests.
- `available()` is `true` unless `memory({ available })` is given a probe of its own, so a candidate list can be gated by application state at construction. `dispose()` clears the `Map`.

## License

[MIT](LICENSE)
