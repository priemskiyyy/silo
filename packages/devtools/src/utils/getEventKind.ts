import type { SiloDiagnosticEvent } from "@priemskiyyy/silo";
import { assertUnreachable } from "src/utils/assertUnreachable";

export type RecordedEventKind =
  "ERROR" | "WRITE" | "READ" | "OUTSIDE" | "MIGRATION" | "STORE";

// A hydrate that landed as `invalid` is a failure the value's status carries.
const landedInvalid = (context: unknown) =>
  typeof context === "object" &&
  context !== null &&
  "outcome" in context &&
  context.outcome === "invalid";

export const getEventKind = (
  event: Pick<SiloDiagnosticEvent, "source" | "type" | "context">,
): RecordedEventKind => {
  if (
    event.type === "write refused" ||
    event.type === "migration failed" ||
    event.type === "observation failed"
  ) {
    return "ERROR";
  }

  if (event.type === "hydrate landed" && landedInvalid(event.context)) {
    return "ERROR";
  }

  if (event.source === "migration") {
    return "MIGRATION";
  }

  if (event.source === "store") {
    return "STORE";
  }

  if (event.source === "value") {
    if (event.type.startsWith("write")) {
      return "WRITE";
    }

    if (event.type.startsWith("outside")) {
      return "OUTSIDE";
    }

    return "READ";
  }

  return assertUnreachable(event.source);
};
