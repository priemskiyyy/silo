import type React from "react";
import clsx from "clsx";
import { IconTile } from "src/components/IconTile/IconTile";
import { STORAGE_ICONS } from "src/components/Playground/storageIcons";
import { PLAYGROUND_STORAGES, STORAGE_LABELS } from "src/silo/playground";
import type { PlaygroundStorage } from "src/silo/playground";
import { chipStyles } from "src/styles/chipStyles";
import type { Place } from "src/utils/describeStorages";

type StorageChipsProps = {
  places: Record<string, Place>;
  value: PlaygroundStorage;
  onSelect: (storage: PlaygroundStorage) => void;
};

/** The first interaction on the page: eight chips in two rows of four, each naming the adapter that won its list. */
export const StorageChips: React.FunctionComponent<StorageChipsProps> = ({
  places,
  value,
  onSelect,
}) => (
  <div
    role="group"
    aria-label="Keep this in"
    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
  >
    {PLAYGROUND_STORAGES.map((storage) => {
      const place = places[storage];

      return (
        <button
          key={storage}
          type="button"
          aria-pressed={value === storage}
          aria-label={STORAGE_LABELS[storage]}
          title={
            place === undefined
              ? undefined
              : `${STORAGE_LABELS[storage]}: ${place.adapter}, ${place.mode}`
          }
          onClick={() => onSelect(storage)}
          className={chipStyles({ selected: value === storage })}
        >
          <IconTile icon={STORAGE_ICONS[storage]} size="small" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {STORAGE_LABELS[storage]}
            </span>
            {place === undefined ? null : (
              <span
                className={clsx(
                  "truncate font-mono text-[10px]",
                  place.adapter === "memory"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                {place.adapter} <span className="opacity-60">{place.mode}</span>
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);
