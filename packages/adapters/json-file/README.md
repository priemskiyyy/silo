<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-json-file

Persist [Silo](../../core) values in a JSON file using synchronous Node filesystem operations.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-json-file @priemskiyyy/silo-memory
```

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { jsonFile } from "@priemskiyyy/silo-json-file";
import { memory } from "@priemskiyyy/silo-memory";

const silo = new Silo({
  storages: {
    default: {
      adapters: [jsonFile({ path: "state.json" }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

silo.value("theme").set("dark");
console.log(silo.value("theme").get()); // "dark", read synchronously
```

## Options

| Option      | Default      | Meaning                                                                                      |
| ----------- | ------------ | -------------------------------------------------------------------------------------------- |
| `path`      | required     | Resolved against the working directory. Created on the first write, parent folders included. |
| `available` | `() => true` | Overrides the synchronous availability check.                                                |

## Behavior

- The path is resolved against the working directory and `silo.native.default.path` reports the absolute one. A missing file reads as empty, and the first write creates it, parent folders included.
- The file holds a JSON array of `[key, value]` entries. Every value is JSON, so a `Date` reads back as a string after a reload and `undefined` is a removal. A file that is not valid JSON, or not an entries array, fails the operation that touched it, which the core reports as a hydrate error.
- The file is loaded once, on first use, and rewritten whole on every write, through a sibling temporary file renamed into place, so a crash mid-write leaves the previous file intact.
- One process at a time. Nothing coordinates two processes writing the same file, and the adapter exposes no `observe`, so a change made by another process is not noticed until the next start.
- `keys` lists every key in the file. `dispose` releases nothing and never deletes the file.
- `available` defaults to `() => true`, since the file is created on the first write. Pass your own probe to gate this candidate on application state at construction, so a list such as `[jsonFile(...), memory()]` falls through when it answers `false`.

## License

[MIT](LICENSE)
