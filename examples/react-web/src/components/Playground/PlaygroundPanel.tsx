import type React from "react";
import {
  ArrowClockwise,
  Browsers,
  CaretRight,
  Compass,
} from "@phosphor-icons/react";
import { useSiloStatus } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { Panel } from "src/components/Panel/Panel";
import { PlaygroundField } from "src/components/Playground/PlaygroundField";
import { StorageChips } from "src/components/Playground/StorageChips";
import { StorageMatrix } from "src/components/Playground/StorageMatrix";
import type { PlaygroundStorage } from "src/silo/playground";
import { buttonStyles } from "src/styles/buttonStyles";
import type { Place } from "src/utils/describeStorages";

type PlaygroundPanelProps = {
  places: Record<string, Place>;
  storage: PlaygroundStorage;
  onStorageSelect: (storage: PlaygroundStorage) => void;
};

/**
 * The same key declared in eight storages, eight distinct values: pick where
 * the note lives and try the things the facts promise. Mounted once per
 * store, so the migration gate's "first read" is what the store said on this
 * load.
 */
export const PlaygroundPanel: React.FunctionComponent<PlaygroundPanelProps> = ({
  places,
  storage,
  onStorageSelect,
}) => {
  const status = useSiloStatus();
  const [firstStatus] = useState(status);
  const place = places[storage];

  return (
    <Panel
      title="Playground"
      icon={Compass}
      shows="The same note and count are declared in eight storages, and the store keeps eight distinct values."
      livesIn={place === undefined ? [] : [place]}
      aside={
        <>
          <button
            type="button"
            onClick={() => {
              window.open(window.location.href);
            }}
            className={buttonStyles({ size: "small" })}
          >
            <Browsers size={12} weight="bold" />
            Open a second tab
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className={buttonStyles({ size: "small" })}
          >
            <ArrowClockwise size={12} weight="bold" />
            Reload
          </button>
        </>
      }
    >
      <StorageChips
        places={places}
        value={storage}
        onSelect={onStorageSelect}
      />
      <PlaygroundField
        key={storage}
        storage={storage}
        gate={{ first: firstStatus, now: status }}
      />
      <details className="group rounded-xl border border-zinc-200 dark:border-zinc-800">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium select-none">
          <CaretRight
            size={14}
            weight="bold"
            className="transition-transform duration-150 group-open:rotate-90"
          />
          Compare all eight
        </summary>
        <div className="px-3 pb-3">
          <StorageMatrix places={places} />
        </div>
      </details>
    </Panel>
  );
};
