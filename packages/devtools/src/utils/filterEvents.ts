import type { RecordSelection } from "src/types/RecordSelection";
import type { RecordedEvent } from "src/utils/EventLog";
import type { RecordedEventKind } from "src/utils/getEventKind";

export type EventFilters = {
  record: RecordSelection | null;
  query: string;
  kind: RecordedEventKind | null;
};

export const filterEvents = (
  events: RecordedEvent[],
  filters: EventFilters,
) => {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    if (filters.kind !== null && event.kind !== filters.kind) {
      return false;
    }

    // Migration and store events stay visible for a selected record: a
    // closed gate is usually why its reads and writes went nowhere.
    const isOtherRecord =
      filters.record !== null &&
      event.source === "value" &&
      (event.key !== filters.record.physicalKey ||
        event.storage !== filters.record.storage);

    if (isOtherRecord) {
      return false;
    }

    return `${event.type} ${event.storage ?? event.source} ${event.key ?? ""} ${event.summary} ${event.context}`
      .toLowerCase()
      .includes(query);
  });
};
