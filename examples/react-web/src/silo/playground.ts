import type { RegisteredKey } from "@priemskiyyy/silo-react";

/** The storages the Playground switches between, in the order the chips list them. */
export const PLAYGROUND_STORAGES = [
  "memory",
  "default",
  "session",
  "journal",
  "preferences",
  "url",
  "shared",
  "remote",
] as const;

export type PlaygroundStorage = (typeof PLAYGROUND_STORAGES)[number];

export const STORAGE_LABELS: Record<PlaygroundStorage, string> = {
  memory: "Memory",
  default: "Local",
  session: "Session",
  journal: "IndexedDB",
  preferences: "Cookie",
  url: "URL",
  shared: "Synced URL",
  remote: "Remote",
};

/** The same `note` key, addressed in each storage: bare for `default`, `storage.key` elsewhere. */
export const NOTE_PATHS = {
  memory: "memory.note",
  default: "note",
  session: "session.note",
  journal: "journal.note",
  preferences: "preferences.note",
  url: "url.note",
  shared: "shared.note",
  remote: "remote.note",
} as const satisfies Record<PlaygroundStorage, RegisteredKey>;

export const COUNT_PATHS = {
  memory: "memory.count",
  default: "count",
  session: "session.count",
  journal: "journal.count",
  preferences: "preferences.count",
  url: "url.count",
  shared: "shared.count",
  remote: "remote.count",
} as const satisfies Record<PlaygroundStorage, RegisteredKey>;

export type StorageFacts = {
  survivesReload: boolean;
  sharedAcrossTabs: boolean;
  liveUpdates: boolean;
  sentToServer: boolean;
  inTheLink: boolean;
  hint: string;
};

export const FACT_COLUMNS = [
  { key: "survivesReload", label: "Survives reload" },
  { key: "sharedAcrossTabs", label: "Shared across tabs" },
  { key: "liveUpdates", label: "Live from other tabs" },
  { key: "sentToServer", label: "Sent to the server" },
  { key: "inTheLink", label: "In the link" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<StorageFacts, "hint">;
  label: string;
}>;

// A data catalog, every cell spelled out: this is the mental model the page
// opens with.
export const STORAGE_FACTS: Record<PlaygroundStorage, StorageFacts> = {
  memory: {
    survivesReload: false,
    sharedAcrossTabs: false,
    liveUpdates: false,
    sentToServer: false,
    inTheLink: false,
    hint: "Gone on reload. The floor every other list falls back to.",
  },
  default: {
    survivesReload: true,
    sharedAcrossTabs: true,
    liveUpdates: true,
    sentToServer: false,
    inTheLink: false,
    hint: "localStorage: synchronous, so the value is right on the first frame.",
  },
  session: {
    survivesReload: true,
    sharedAcrossTabs: false,
    liveUpdates: false,
    sentToServer: false,
    inTheLink: false,
    hint: "sessionStorage: this tab only, a second tab starts empty.",
  },
  journal: {
    survivesReload: true,
    sharedAcrossTabs: true,
    liveUpdates: true,
    sentToServer: false,
    inTheLink: false,
    hint: "IndexedDB: asynchronous, structured clone, room for documents.",
  },
  preferences: {
    survivesReload: true,
    sharedAcrossTabs: true,
    liveUpdates: false,
    sentToServer: true,
    inTheLink: false,
    hint: "A cookie: small, and on every request to your server.",
  },
  url: {
    survivesReload: true,
    sharedAcrossTabs: false,
    liveUpdates: false,
    sentToServer: false,
    inTheLink: true,
    hint: "The query string: watch the address bar as you type. A second tab keeps its own link.",
  },
  shared: {
    survivesReload: true,
    sharedAcrossTabs: true,
    liveUpdates: true,
    sentToServer: false,
    inTheLink: true,
    hint: "The fragment, shared across tabs: the other tabs' address bars follow this one, and a reload there reads it.",
  },
  remote: {
    survivesReload: true,
    sharedAcrossTabs: true,
    liveUpdates: true,
    sentToServer: true,
    inTheLink: false,
    hint: "A REST key-value server over fetch, with a realtime channel telling the other tabs. Watch the Server card in step 3.",
  },
};
