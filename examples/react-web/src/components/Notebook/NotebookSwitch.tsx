import type React from "react";
import { useNotebookEntryCount } from "src/hooks/useNotebookEntryCount";
import { NOTEBOOK_IDS } from "src/state/applicationReducer";
import type { NotebookId } from "src/state/applicationReducer";
import { PILL_CLASS_NAME } from "src/styles/pillStyles";
import { segmentStyles } from "src/styles/segmentStyles";

type NotebookSwitchProps = {
  value: NotebookId;
  onSelect: (notebookId: NotebookId) => void;
};

type NotebookButtonProps = {
  notebookId: NotebookId;
  selected: boolean;
  onSelect: () => void;
};

const LABELS: Record<NotebookId, string> = {
  alpine: "Alpine",
  coast: "Coast",
  desert: "Desert",
};

const NotebookButton: React.FunctionComponent<NotebookButtonProps> = ({
  notebookId,
  selected,
  onSelect,
}) => {
  const count = useNotebookEntryCount(notebookId);

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={LABELS[notebookId]}
      onClick={onSelect}
      className={segmentStyles({ selected })}
    >
      {LABELS[notebookId]}
      <span
        aria-hidden="true"
        className="rounded-full bg-zinc-200/80 px-1.5 font-mono text-[10px] text-zinc-600 tabular-nums dark:bg-zinc-700 dark:text-zinc-300"
      >
        {count}
      </span>
    </button>
  );
};

/** A notebook is a scope: the same schema under `notebooks:<id>`, nothing copied between them. */
export const NotebookSwitch: React.FunctionComponent<NotebookSwitchProps> = ({
  value,
  onSelect,
}) => (
  <div role="group" aria-label="Notebook" className={PILL_CLASS_NAME}>
    {NOTEBOOK_IDS.map((notebookId) => (
      <NotebookButton
        key={notebookId}
        notebookId={notebookId}
        selected={value === notebookId}
        onSelect={() => onSelect(notebookId)}
      />
    ))}
  </div>
);
