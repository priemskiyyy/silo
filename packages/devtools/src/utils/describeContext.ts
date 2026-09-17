import type { SiloDiagnosticEvent } from "@priemskiyyy/silo";
import { formatContextSummary } from "src/formatting/formatContextSummary";
import { formatContextText } from "src/formatting/formatContextText";
import { getEventKind } from "src/utils/getEventKind";
import type { RecordedEventKind } from "src/utils/getEventKind";
import { inspectContext } from "src/utils/inspectContext";

export type DescribedContext = {
  context: string;
  summary: string;
  kind: RecordedEventKind;
};

/** Row text, summary and kind for one event, computed once when it is recorded. */
export const describeContext = (
  event: SiloDiagnosticEvent,
  showValues: boolean,
): DescribedContext => {
  const kind = getEventKind(event);

  try {
    const value = inspectContext(event.context, showValues);

    return {
      context: formatContextText(value),
      summary: formatContextSummary(value),
      kind,
    };
  } catch {
    return { context: "[Unable to inspect this value]", summary: "", kind };
  }
};
