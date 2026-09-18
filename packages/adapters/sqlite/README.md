<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-sqlite

Persist [Silo](../../core) values through an existing synchronous SQLite connection. The application opens and closes the connection.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-sqlite @priemskiyyy/silo-memory
```

`node:sqlite` ships with Node 22.13 and newer and needs no package. For `better-sqlite3` or `bun:sqlite`, install or use the one you already have.

## Create a silo

```ts
import { DatabaseSync } from "node:sqlite";
import { Silo, value } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import { sqlite } from "@priemskiyyy/silo-sqlite";

const database = new DatabaseSync("state.db");
const silo = new Silo({
  storages: {
    default: {
      adapters: [sqlite({ database }), memory()],
      schema: {
        theme: value<"light" | "dark">({ fallback: "light" }),
      },
    },
  },
});

silo.value("theme").set("dark");
console.log(silo.value("theme").get()); // "dark", read synchronously
```

The same two lines with the other libraries:

```ts
import Database from "better-sqlite3";
sqlite({ database: new Database("state.db") });

import { Database } from "bun:sqlite";
sqlite({ database: new Database("state.db") });
```

## Options

| Option      | Default      | Meaning                                                                                                                    |
| ----------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `database`  | required     | An open connection the application owns, opens and closes.                                                                 |
| `table`     | `"silo"`     | The key-value table, created on first use. Letters, digits and underscores only.                                           |
| `available` | `() => true` | Overrides the synchronous availability check.                                                                              |
| `format`    | `JSON`       | How values become text and back. `superjson` and `devalue` fit as they are; changing it over existing data is a migration. |

## Behavior

- The application opens the connection and closes it. `dispose` releases nothing, and `silo.native.default` is the connection.
- The table, `silo` unless `table` says otherwise, is created on first use with `key TEXT PRIMARY KEY, value TEXT NOT NULL`. One table per store; two stores over one database take two table names. A table name is letters, digits and underscores only, because it is interpolated into SQL.
- Values are text: `JSON` by default, or the `format` you pass, which is anything with `stringify` and `parse`, so `superjson` and `devalue` drop in. Anything the format cannot express does not survive, and `undefined` is a removal. Changing the format over existing data is a migration, since the stored text stays what the old format wrote. A row this adapter did not write, text the format cannot parse or a value that is not text, throws on read, which the core reports as a hydrate error and leaves in place for `set` to overwrite.
- `available` defaults to `() => true` because the connection was handed over. Pass your own probe to gate this candidate on application state at construction, so a list such as `[sqlite(...), memory()]` falls through when it answers `false`.
- `keys` lists every key in the table, so a migration can reach scoped data.
- Nothing reports a change made through another connection or process, so there is no `observe`. Journal mode, busy timeouts and the rest are the application's `PRAGMA`s on the connection it hands over.

## License

[MIT](LICENSE)
