import type { RecordedEventKind } from "src/utils/getEventKind";

export const formatEventKind = (kind: RecordedEventKind) => {
  const LABELS: Record<RecordedEventKind, string> = {
    ERROR: "Errors",
    WRITE: "Writes",
    READ: "Reads",
    OUTSIDE: "Outside",
    MIGRATION: "Migrations",
    STORE: "Store",
  };

  return LABELS[kind];
};
