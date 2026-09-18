import { Broom } from "@phosphor-icons/react";
import { useSilo } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { NotebookSwitch } from "src/components/Notebook/NotebookSwitch";
import type { NotebookId } from "src/state/applicationReducer";
import { buttonStyles } from "src/styles/buttonStyles";

type NotebookToolbarProps = {
  notebookId: NotebookId;
  onNotebookSelect: (notebookId: NotebookId) => void;
};

type ClearState =
  | { state: "idle" | "confirming" | "clearing" | "cleared" }
  | { state: "error"; message: string };

export const NotebookToolbar = ({
  notebookId,
  onNotebookSelect,
}: NotebookToolbarProps) => {
  const silo = useSilo();
  const [clear, setClear] = useState<ClearState>({ state: "idle" });

  const handleClearPress = async () => {
    setClear({ state: "clearing" });
    try {
      await silo.scope(`notebooks:${notebookId}`).clear();
      setClear({ state: "cleared" });
    } catch {
      setClear({
        state: "error",
        message: "Some data could not be removed. Try clearing again.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <NotebookSwitch value={notebookId} onSelect={onNotebookSelect} />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Each notebook keeps its own entries, draft, and supplies.
        </p>
        <button
          type="button"
          onClick={() => setClear({ state: "confirming" })}
          disabled={clear.state === "clearing"}
          className={`${buttonStyles({ variant: "ghost" })} sm:ml-auto`}
        >
          <Broom size={14} /> Clear this notebook
        </button>
      </div>
      {clear.state === "confirming" ? (
        <div
          role="group"
          aria-label="Confirm notebook removal"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30"
        >
          <p className="mr-auto text-sm">
            Remove all entries, the draft, and supplies from{" "}
            <strong className="capitalize">{notebookId}</strong>? This cannot be
            undone.
          </p>
          <button
            type="button"
            onClick={() => setClear({ state: "idle" })}
            className={buttonStyles()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleClearPress}
            className={buttonStyles({ variant: "primary" })}
          >
            Confirm clear
          </button>
        </div>
      ) : null}
      <p
        role="status"
        className="text-sm text-zinc-600 empty:hidden dark:text-zinc-400"
      >
        {clear.state === "clearing" ? "Clearing notebook…" : null}
        {clear.state === "cleared"
          ? "Notebook cleared. Your other notebooks and preferences are unchanged."
          : null}
        {clear.state === "error" ? clear.message : null}
      </p>
    </div>
  );
};
