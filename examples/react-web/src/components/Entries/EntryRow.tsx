import type React from "react";
import { Star, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { formatRelativeTime } from "src/formatting/formatRelativeTime";
import type { Entry } from "src/silo/Entry";
import { buttonStyles } from "src/styles/buttonStyles";

type EntryRowProps = {
  entry: Entry;
  now: number;
  selected: boolean;
  onSelect: () => void;
  onStarToggle: () => void;
  onRemove: () => void;
};

export const EntryRow: React.FunctionComponent<EntryRowProps> = ({
  entry,
  now,
  selected,
  onSelect,
  onStarToggle,
  onRemove,
}) => (
  <li
    className={clsx(
      "flex items-start gap-2 rounded-xl border px-3 py-2 transition",
      selected
        ? "border-amber-500/60 bg-amber-50/60 ring-2 ring-amber-500/60 dark:bg-amber-950/30"
        : "border-transparent hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60",
    )}
  >
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{entry.title}</span>
        <time
          dateTime={entry.createdAt.toISOString()}
          className="text-xs text-zinc-500 dark:text-zinc-400"
        >
          {formatRelativeTime(entry.createdAt, now)}
        </time>
      </p>
      {entry.body === "" ? null : (
        <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">
          {entry.body}
        </p>
      )}
      {entry.tags.size === 0 ? null : (
        <p className="mt-1 flex flex-wrap gap-1">
          {[...entry.tags].map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-zinc-100 px-1.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              #{tag}
            </span>
          ))}
        </p>
      )}
    </button>
    <button
      type="button"
      aria-pressed={entry.starred}
      aria-label={`${entry.starred ? "Unstar" : "Star"} ${entry.title}`}
      onClick={onStarToggle}
      className={buttonStyles({ variant: "ghost", size: "icon" })}
    >
      <Star
        size={16}
        weight={entry.starred ? "fill" : "regular"}
        className={entry.starred ? "text-amber-500" : undefined}
      />
    </button>
    <button
      type="button"
      aria-label={`Remove ${entry.title}`}
      onClick={onRemove}
      className={buttonStyles({ variant: "ghost", size: "icon" })}
    >
      <Trash size={16} />
    </button>
  </li>
);
