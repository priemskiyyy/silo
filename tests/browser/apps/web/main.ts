import { Silo, value } from "@priemskiyyy/silo";
import type { SiloSchema } from "@priemskiyyy/silo";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import { localStorage as localStorageAdapter } from "@priemskiyyy/silo-local-storage";
import { sessionStorage as sessionStorageAdapter } from "@priemskiyyy/silo-session-storage";

const DATABASE = "silo-browser-tests";
const STORE = "values";
/** Fixed, so the structured-clone round trip asserts an exact value. */
const WRITTEN_AT = new Date("2024-03-04T05:06:07.000Z");

type Journal = { when: Date; tags: Map<string, number>; bytes: ArrayBuffer };

const schema = {
  note: value({ fallback: "(none)" }),
  count: value({ fallback: 0 }),
  journal: value<Journal>(),
  blob: value<Blob>(),
} satisfies SiloSchema;

const element = (testId: string) => {
  const found = document.querySelector(`[data-testid="${testId}"]`);

  if (found === null) {
    throw new Error(`The browser fixture has no element named "${testId}".`);
  }

  return found;
};

const field = (testId: string) => {
  const found = element(testId);

  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`The element named "${testId}" is not an input.`);
  }

  return found;
};

const show = (testId: string, text: string) => {
  element(testId).textContent = text;
};

/** Async handlers report their failure into the page, so a test reads the reason instead of timing out. */
const onClick = (testId: string, run: () => Promise<void>) => {
  element(testId).addEventListener("click", () => {
    run().catch((error: unknown) => {
      show("error", `${testId}: ${String(error)}`);
    });
  });
};

const local = new Silo({
  storages: { default: { adapters: [localStorageAdapter()], schema: schema } },
});
const session = new Silo({
  storages: {
    default: { adapters: [sessionStorageAdapter()], schema: schema },
  },
});
const database = new Silo({
  storages: {
    default: {
      adapters: [indexedDb({ name: DATABASE, store: STORE })],
      schema: schema,
    },
  },
});

const note = local.value("note");
const sessionNote = session.value("note");
const count = database.value("count");
const journal = database.value("journal");
const blob = database.value("blob");

// Every field reports what it came back AS, not what it was declared as: a
// backend that went through JSON would answer "string" and "object" here.
const describeJournal = (value: Journal | undefined) => {
  if (value === undefined) {
    return "absent";
  }

  return JSON.stringify({
    when:
      value.when instanceof Date ? value.when.toISOString() : typeof value.when,
    tags:
      value.tags instanceof Map
        ? Object.fromEntries(value.tags)
        : typeof value.tags,
    bytes:
      value.bytes instanceof ArrayBuffer
        ? [...new Uint8Array(value.bytes)]
        : typeof value.bytes,
  });
};

const describeBlob = async (value: Blob | undefined) => {
  if (value === undefined) {
    return "absent";
  }

  if (!(value instanceof Blob)) {
    return typeof value;
  }

  return JSON.stringify({ type: value.type, text: await value.text() });
};

// ponytail: no generation guard on the async render, because the fixture writes
// the blob once per test. Add one if a test ever writes it twice in a frame.
const renderBlob = () => {
  describeBlob(blob.get())
    .then((text) => show("db-blob", text))
    .catch((error: unknown) => show("error", `blob: ${String(error)}`));
};

const renderNote = () => show("local-note", note.get());
const renderSessionNote = () => show("session-note", sessionNote.get());
const renderCount = () => show("db-count", String(count.get()));
const renderStatus = () => show("db-status", count.status.get().state);
const renderJournal = () => show("db-journal", describeJournal(journal.get()));

note.subscribe(renderNote);
sessionNote.subscribe(renderSessionNote);
count.subscribe(renderCount);
count.status.subscribe(renderStatus);
journal.subscribe(renderJournal);
blob.subscribe(renderBlob);
renderNote();
renderSessionNote();
renderCount();
renderStatus();
renderJournal();
renderBlob();

element("write-note").addEventListener("click", () => {
  const text = field("note-input").value;
  note.set(`local:${text}`);
  sessionNote.set(`session:${text}`);
});

onClick("increment", async () => {
  const next = count.get() + 1;
  count.set(next);
  // The barrier is what lets the test reload without racing the transaction.
  await count.flush();
  show("db-flush", `count:${String(next)}`);
});

onClick("write-journal", async () => {
  journal.set({
    when: WRITTEN_AT,
    tags: new Map([
      ["a", 1],
      ["b", 2],
    ]),
    bytes: new Uint8Array([1, 2, 3]).buffer,
  });
  await journal.flush();
  show("db-flush", "journal");
});

onClick("write-blob", async () => {
  blob.set(new Blob(["silo"], { type: "text/plain" }));
  await blob.flush();
  show("db-flush", "blob");
});

/**
 * Real IndexedDB deactivates a transaction once the task that created it ends,
 * so anything awaited across that boundary loses it. This is the auto-commit
 * the adapter stays out of by awaiting its connection BEFORE it opens one.
 */
const probeDeactivation = async () => {
  const connection = await database.native.default.database();
  const transaction = connection.transaction(STORE, "readwrite");
  // Taken inside the creating task, the way an adapter that opened its
  // transaction too early would already be holding it.
  const target = transaction.objectStore(STORE);
  await new Promise((resolve) => setTimeout(resolve, 0));

  try {
    target.put(1, "probe");
    return "active";
  } catch (error) {
    return error instanceof DOMException ? error.name : "unknown";
  }
};

/**
 * The same boundary from the adapter's side: a cold adapter is still opening
 * when the first write arrives, and every one of them has to commit anyway.
 */
const probeColdWrites = async () => {
  const cold = new Silo({
    storages: {
      default: {
        adapters: [
          indexedDb({ name: DATABASE, store: STORE, sharing: "single-tab" }),
        ],
        schema: schema,
      },
    },
    namespace: "probe",
  });
  const writing = cold.value("count");

  writing.set(1);
  writing.set(2);
  writing.set(3);
  await writing.flush();
  cold.dispose();

  const reading = new Silo({
    storages: {
      default: {
        adapters: [
          indexedDb({ name: DATABASE, store: STORE, sharing: "single-tab" }),
        ],
        schema: schema,
      },
    },
    namespace: "probe",
  });
  const persisted = reading.value("count");

  await persisted.hydrated();
  const committed = persisted.get();
  reading.dispose();

  return committed;
};

onClick("probe-transaction", async () => {
  const afterTask = await probeDeactivation();
  const coldWrites = await probeColdWrites();
  show("probe", JSON.stringify({ afterTask, coldWrites }));
});
