import type React from "react";
import { Browsers, Minus, Plus } from "@phosphor-icons/react";
import type { SiloStatus } from "@priemskiyyy/silo";
import { useId, useState } from "react";
import { Badge } from "src/components/Badge/Badge";
import { SaveBadge } from "src/components/Badge/SaveBadge";
import { StatusTimeline } from "src/components/Badge/StatusTimeline";
import { StorageFacts } from "src/components/Playground/StorageFacts";
import { Skeleton } from "src/components/Skeleton/Skeleton";
import { formatSiloStatus } from "src/formatting/formatSiloStatus";
import { formatValueStatus } from "src/formatting/formatValueStatus";
import { useDurableValue } from "src/hooks/useDurableValue";
import { COUNT_PATHS, NOTE_PATHS } from "src/silo/playground";
import type { PlaygroundStorage } from "src/silo/playground";
import { buttonStyles } from "src/styles/buttonStyles";
import { FIELD_CLASS_NAME } from "src/styles/fieldStyles";

type PlaygroundFieldProps = {
  storage: PlaygroundStorage;
  /** The store's status when the Playground first rendered, and now. */
  gate: { first: SiloStatus; now: SiloStatus };
};

/**
 * One note and one counter in the selected storage. Mounted fresh per
 * storage (the parent keys it), so "first read" is what this storage answered
 * when it was reached, not what it answers now.
 */
export const PlaygroundField: React.FunctionComponent<PlaygroundFieldProps> = ({
  storage,
  gate,
}) => {
  const noteId = useId();
  const note = useDurableValue(NOTE_PATHS[storage]);
  const count = useDurableValue(COUNT_PATHS[storage]);
  const [firstStatus] = useState(note.status);
  const hydrating = note.status.state === "hydrating";
  const changedOutside = note.changedOutside || count.changedOutside;
  const first = formatValueStatus(firstStatus);
  const now = formatValueStatus(note.status);
  const gateFirst = formatSiloStatus(gate.first);
  const gateNow = formatSiloStatus(gate.now);

  return (
    <div className="flex flex-col gap-3">
      <div
        data-changed-outside={changedOutside}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
      >
        {/* The badges sit beside the label, not inside it: a button in a label is named by it and clicks through to the input. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <label htmlFor={noteId}>Note</label>
          <div className="min-w-48 flex-1">
            {hydrating ? (
              <Skeleton variant="field" />
            ) : (
              <input
                id={noteId}
                placeholder="Type, then reload or open a second tab"
                value={note.value}
                onChange={(event) => note.persist(event.target.value)}
                className={`${FIELD_CLASS_NAME} w-full`}
              />
            )}
          </div>
          <SaveBadge save={note.save} onRetry={note.retry} />
          <span
            aria-label="Note writes"
            className="font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400"
          >
            {note.writes.accepted} writes, {note.writes.durable} durable
          </span>
          {changedOutside ? (
            <Badge tone="accent" icon={Browsers}>
              Changed in another tab
            </Badge>
          ) : null}
          <span>Count</span>
          <div
            role="group"
            aria-label="Count"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button
              type="button"
              aria-label="Count one less"
              disabled={hydrating || count.value === 0}
              onClick={() => count.persist(count.value - 1)}
              className={buttonStyles({ variant: "ghost", size: "icon" })}
            >
              <Minus size={14} weight="bold" />
            </button>
            {hydrating ? (
              <Skeleton variant="line" />
            ) : (
              <span className="min-w-10 text-center font-mono text-sm tabular-nums">
                {count.value}
              </span>
            )}
            <button
              type="button"
              aria-label="Count one more"
              disabled={hydrating}
              onClick={() => count.persist(count.value + 1)}
              className={buttonStyles({ variant: "ghost", size: "icon" })}
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
          <SaveBadge save={count.save} onRetry={count.retry} />
        </div>
        <StorageFacts storage={storage} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Value status
          </span>
          <StatusTimeline
            name="Value status"
            steps={[
              { label: "first read", tone: first.tone, text: first.label },
              { label: "now", tone: now.tone, text: now.label },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Migration gate
          </span>
          <StatusTimeline
            name="Migration gate"
            steps={[
              {
                label: "first read",
                tone: gateFirst.tone,
                text: gateFirst.label,
              },
              { label: "now", tone: gateNow.tone, text: gateNow.label },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
