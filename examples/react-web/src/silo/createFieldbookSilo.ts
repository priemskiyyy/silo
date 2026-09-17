import { Silo, value } from "@priemskiyyy/silo";
import { cookie } from "@priemskiyyy/silo-cookie";
import { http } from "@priemskiyyy/silo-http";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { searchParams } from "@priemskiyyy/silo-search-params";
import { sessionStorage as sessionStorageAdapter } from "@priemskiyyy/silo-session-storage";
import { simulcast } from "@priemskiyyy/silo-simulcast";
import { z } from "zod";
import type { Entry } from "src/silo/Entry";
import type { Faults } from "src/silo/adapters/createFaults";
import { createFaults } from "src/silo/adapters/createFaults";
import { delayed } from "src/silo/adapters/delayed";
import { flaky } from "src/silo/adapters/flaky";
import { integerCodec } from "src/silo/integerCodec";
import { plainTextFormat } from "src/silo/plainTextFormat";
import { realtime } from "src/silo/realtime";
import { server } from "src/silo/server/server";
import type { LabFlags } from "src/state/applicationReducer";

export type Theme = "light" | "dark" | "system";
export type Density = "comfortable" | "compact";
export type Units = "metric" | "imperial";

// Zod is a Standard Schema, so a hand-edited URL is validated on the way in:
// a value outside the enum reads as the fallback with a hydrate error.
const filterSchema = z.enum(["all", "today", "starred"]);
const sortSchema = z.enum(["newest", "oldest"]);

export type Filter = z.infer<typeof filterSchema>;
export type Sort = z.infer<typeof sortSchema>;
export const FILTERS = filterSchema.options;
export const SORTS = sortSchema.options;

/** Milliseconds the slow journal adds to every operation. */
export const SLOW_JOURNAL_LATENCY = 900;
/** How long quiet hours last, checked lazily by the core when the raw value arrives. */
export const QUIET_HOURS_LENGTH = 60_000;
const COOKIE_LIFETIME = 60 * 60 * 24 * 30;

/** The version the schema is at; the migration keyed by it renamed `legacyTheme`. */
export const FIELDBOOK_VERSION = 2;

// The same two keys in every storage, eight distinct values: the Playground
// switches between them to show where a value should live.
const playground = () => ({
  note: value({ fallback: "" }),
  count: value({ fallback: 0 }),
});

// Eight storages, each chosen for what it is good at, every list ending in
// memory so the store constructs anywhere.
const createStorages = (flags: LabFlags, faults: Faults) => ({
  default: {
    adapters: [
      localStorageAdapter({ available: () => !flags.privateMode }),
      memory(),
    ],
    schema: {
      ...playground(),
      theme: value<Theme>({ fallback: "system" }),
      density: value<Density>({ fallback: "comfortable" }),
      visits: value({ fallback: 0 }),
      quietUntil: value<number>({ expires: { in: QUIET_HOURS_LENGTH } }),
    },
  },
  memory: {
    adapters: [memory()],
    schema: playground(),
  },
  session: {
    adapters: [sessionStorageAdapter(), memory()],
    schema: {
      ...playground(),
      composer: value({ fallback: "" }),
      selectedEntry: value<string>(),
    },
  },
  journal: {
    adapters: [
      flaky(
        delayed(
          indexedDb({ name: "fieldbook" }),
          flags.slowJournal ? SLOW_JOURNAL_LATENCY : 0,
        ),
        faults,
      ),
      memory(),
    ],
    schema: {
      ...playground(),
      entries: value<Entry[]>({ fallback: [] }),
      supplies: value<Map<string, number>>({ fallback: new Map() }),
    },
  },
  url: {
    // Plain text in the address bar, so the link reads `?note=hello`; the
    // count carries its own codec because every value comes back as text.
    adapters: [searchParams({ format: plainTextFormat }), memory()],
    schema: {
      note: value({ fallback: "" }),
      count: value({ codec: integerCodec, fallback: 0 }),
      filter: value<Filter>({ schema: filterSchema, fallback: "all" }),
      sort: value<Sort>({ schema: sortSchema, fallback: "newest" }),
      query: value({ schema: z.string(), fallback: "" }),
    },
  },
  shared: {
    // The same adapter shared across tabs, in the fragment so its keys never
    // meet the query string's: a write here is announced to the other tabs
    // on this path, and each writes it into its own address bar.
    adapters: [
      searchParams({
        hash: true,
        sharing: "cross-tab",
        format: plainTextFormat,
      }),
      memory(),
    ],
    schema: {
      note: value({ fallback: "" }),
      count: value({ codec: integerCodec, fallback: 0 }),
    },
  },
  preferences: {
    adapters: [cookie({ maxAge: COOKIE_LIFETIME }), memory()],
    schema: {
      ...playground(),
      units: value<Units>({ fallback: "metric" }),
    },
  },
  remote: {
    // The http adapter holds the data on the server in this page; the
    // simulcast bridge announces each write on a channel and applies what
    // the other tabs announce, so a remote value is live without polling.
    adapters: [
      simulcast({
        adapter: http({ url: server.url, fetch: server.fetch }),
        channel: realtime.channel(server.channel),
        publish: server.announce,
      }),
      memory(),
    ],
    schema: playground(),
  },
});

export type FieldbookStorages = ReturnType<typeof createStorages>;

/**
 * One store for the whole application. The Lab flags change candidate lists,
 * so a flag change builds a new store rather than mutating a live one. The
 * storages come back beside it because the Playground derives its chips from
 * the same lists the store chose from, and the faults because the Lab flips
 * them.
 */
export const createFieldbookSilo = (flags: LabFlags) => {
  // The faults live with the store: the flaky adapter reads them when a
  // write arrives, and the Lab flips them without rebuilding anything.
  const faults = createFaults();
  const storages = createStorages(flags, faults);

  return {
    storages,
    faults,
    silo: new Silo({
      storages,
      // Every storage but the URL keeps this prefix: `fieldbook:theme` in
      // localStorage, `fieldbook:units` as the cookie's name.
      namespace: "fieldbook",
      // Version 2 renamed the theme key; the Lab's "Plant v1 data" puts the
      // old shape back. The version lives in the default storage, and
      // localStorage answers in the same frame, so a warm start opens the
      // gate before the first render.
      migrations: {
        [FIELDBOOK_VERSION]: async (store) => {
          await store.rename("legacyTheme", "theme");
        },
      },
    }),
  };
};

declare module "@priemskiyyy/silo-react" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface.
  interface Register {
    silo: ReturnType<typeof createFieldbookSilo>["silo"];
  }
}
