import type React from "react";
import {
  ArrowClockwise,
  CloudArrowUp,
  PencilLine,
} from "@phosphor-icons/react";
import { useValue } from "@priemskiyyy/silo-react";
import { Badge } from "src/components/Badge/Badge";
import { WritePipeline } from "src/components/Composer/WritePipeline";
import { Panel } from "src/components/Panel/Panel";
import { useDurableValue } from "src/hooks/useDurableValue";
import { buttonStyles } from "src/styles/buttonStyles";
import { createEntry } from "src/utils/createEntry";
import type { Place } from "src/utils/describeStorages";

type ComposerPanelProps = {
  livesIn: Place[];
};

/**
 * The composer is sessionStorage: this tab only, gone with it. Saving moves
 * the text into the journal and waits on `flush()`, which is the only way to
 * know the transaction committed; a refused write is kept by the hook and
 * Retry writes the same value again.
 */
export const ComposerPanel: React.FunctionComponent<ComposerPanelProps> = ({
  livesIn,
}) => {
  const [composer, setComposer] = useValue("session.composer");
  const entries = useDurableValue("journal.entries");
  const editing = composer.trim() !== "";

  const handleSavePress = () => {
    if (!editing) {
      return;
    }

    entries.persist([createEntry(composer), ...entries.value]);
    setComposer("");
  };

  return (
    <Panel
      title="Composer"
      icon={PencilLine}
      shows="A draft in sessionStorage, this tab only, and the write pipeline a save goes through."
      livesIn={livesIn}
      aside={<Badge tone="neutral">This tab only</Badge>}
    >
      <textarea
        aria-label="Composer"
        placeholder={"Title on the first line\nThen the entry. #tags work."}
        value={composer}
        onChange={(event) => setComposer(event.target.value)}
        rows={4}
        className="min-h-24 flex-1 resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm shadow-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-amber-400"
      />
      <WritePipeline save={entries.save} editing={editing} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
          {composer.length} characters
        </span>
        {entries.save.state === "REFUSED" ? (
          <>
            <span className="text-xs text-rose-600 dark:text-rose-300">
              {String(entries.save.cause)}
            </span>
            <button
              type="button"
              onClick={entries.retry}
              className={buttonStyles()}
            >
              <ArrowClockwise size={14} weight="bold" />
              Retry
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={handleSavePress}
          disabled={!editing}
          className={buttonStyles({ variant: "primary" })}
        >
          <CloudArrowUp size={14} weight="bold" />
          Save as entry
        </button>
      </div>
    </Panel>
  );
};
