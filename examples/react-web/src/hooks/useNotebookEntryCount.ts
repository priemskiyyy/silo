import { useSilo } from "@priemskiyyy/silo-react";
import { useMemo, useSyncExternalStore } from "react";
import type { NotebookId } from "src/state/applicationReducer";

/** How many entries a notebook holds, read at its own scope from anywhere. Reaching it hydrates it, which is the cost of the number. */
export const useNotebookEntryCount = (notebookId: NotebookId) => {
  const silo = useSilo();
  const entries = useMemo(
    () => silo.scope(`notebooks:${notebookId}`).value("journal.entries"),
    [silo, notebookId],
  );

  return useSyncExternalStore(entries.subscribe, entries.get).length;
};
