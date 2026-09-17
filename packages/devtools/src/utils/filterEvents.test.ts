import { expect, test } from "vitest";
import type { RecordedEvent } from "src/utils/EventLog";
import { filterEvents } from "src/utils/filterEvents";

const recorded = (
  overrides: Partial<RecordedEvent> & Pick<RecordedEvent, "id" | "type">,
): RecordedEvent => ({
  source: "value",
  storage: "default",
  key: "silo:theme",
  timestamp: 0,
  context: "{}",
  summary: "",
  kind: "WRITE",
  ...overrides,
});

const events = [
  recorded({ id: 1, type: "write accepted", summary: "set" }),
  recorded({ id: 2, type: "write refused", kind: "ERROR", summary: "quota" }),
  recorded({ id: 3, type: "write durable", key: "silo:other" }),
  recorded({ id: 4, type: "write durable", storage: "secure" }),
  recorded({
    id: 5,
    type: "migration done",
    source: "migration",
    storage: null,
    key: null,
    kind: "MIGRATION",
  }),
];

const ids = (filtered: RecordedEvent[]) => filtered.map((event) => event.id);

test("a selected record keeps its own events and the store-wide ones", () => {
  const filtered = filterEvents(events, {
    record: { storage: "default", physicalKey: "silo:theme" },
    query: "",
    kind: null,
  });

  expect(ids(filtered)).toEqual([1, 2, 5]);
});

test("the search matches type, storage, key and summary, and kinds narrow further", () => {
  expect(
    ids(filterEvents(events, { record: null, query: "QUOTA", kind: null })),
  ).toEqual([2]);
  expect(
    ids(filterEvents(events, { record: null, query: "secure", kind: null })),
  ).toEqual([4]);
  expect(
    ids(filterEvents(events, { record: null, query: "other", kind: null })),
  ).toEqual([3]);
  expect(
    ids(filterEvents(events, { record: null, query: "migration", kind: null })),
  ).toEqual([5]);
  expect(
    ids(
      filterEvents(events, { record: null, query: "durable", kind: "WRITE" }),
    ),
  ).toEqual([3, 4]);
  expect(
    ids(filterEvents(events, { record: null, query: "", kind: "ERROR" })),
  ).toEqual([2]);
});
