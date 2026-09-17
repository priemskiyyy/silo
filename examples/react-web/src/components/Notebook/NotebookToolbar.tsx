import type React from "react";
import { Broom } from "@phosphor-icons/react";
import { useSilo } from "@priemskiyyy/silo-react";
import { NotebookSwitch } from "src/components/Notebook/NotebookSwitch";
import type { NotebookId } from "src/state/applicationReducer";
import { buttonStyles } from "src/styles/buttonStyles";

type NotebookToolbarProps = {
  notebookId: NotebookId;
  onNotebookSelect: (notebookId: NotebookId) => void;
};

/** Which notebook the panels below show, and the one action that touches a whole scope. */
export const NotebookToolbar: React.FunctionComponent<NotebookToolbarProps> = ({
  notebookId,
  onNotebookSelect,
}) => {
  const silo = useSilo();
  // A refused removal lands on each value's status, so the barrier's
  // rejection carries nothing the toolbar would show on top of it.
  const handleClearPress = () => {
    silo
      .scope(`notebooks:${notebookId}`)
      .clear()
      .catch(() => undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <NotebookSwitch value={notebookId} onSelect={onNotebookSelect} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        A notebook is a scope: the same keys under{" "}
        <code className="font-mono">notebooks:{notebookId}</code>, nothing
        copied between them.
      </p>
      <button
        type="button"
        onClick={handleClearPress}
        className={`${buttonStyles()} sm:ml-auto`}
      >
        <Broom size={14} weight="bold" />
        Clear this notebook
      </button>
    </div>
  );
};
