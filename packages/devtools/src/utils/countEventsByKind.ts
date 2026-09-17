import type { RecordedEvent } from "src/utils/EventLog";
import type { RecordedEventKind } from "src/utils/getEventKind";

export const countEventsByKind = (events: RecordedEvent[]) => {
  const counts: Record<RecordedEventKind, number> = {
    ERROR: 0,
    WRITE: 0,
    READ: 0,
    OUTSIDE: 0,
    MIGRATION: 0,
    STORE: 0,
  };

  for (const event of events) {
    counts[event.kind] += 1;
  }

  return counts;
};
