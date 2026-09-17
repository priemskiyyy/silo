import type React from "react";
import { Check, Minus } from "@phosphor-icons/react";
import { Badge } from "src/components/Badge/Badge";
import { IconTile } from "src/components/IconTile/IconTile";
import { STORAGE_ICONS } from "src/components/Playground/storageIcons";
import {
  FACT_COLUMNS,
  PLAYGROUND_STORAGES,
  STORAGE_FACTS,
  STORAGE_LABELS,
} from "src/silo/playground";
import type { PlaygroundStorage } from "src/silo/playground";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";
import type { Place } from "src/utils/describeStorages";

type StorageMatrixProps = {
  places: Record<string, Place>;
};

type FactProps = {
  holds: boolean;
};

const Fact: React.FunctionComponent<FactProps> = ({ holds }) =>
  holds ? (
    <Check
      size={16}
      weight="bold"
      aria-label="yes"
      className="inline text-emerald-600 dark:text-emerald-400"
    />
  ) : (
    <Minus
      size={14}
      aria-label="no"
      className="inline text-zinc-300 dark:text-zinc-700"
    />
  );

type StorageNameProps = {
  storage: PlaygroundStorage;
  place: Place | undefined;
};

const StorageName: React.FunctionComponent<StorageNameProps> = ({
  storage,
  place,
}) => (
  <div className="flex items-center gap-3">
    <IconTile icon={STORAGE_ICONS[storage]} size="small" />
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{STORAGE_LABELS[storage]}</span>
        {place === undefined ? null : (
          <Badge tone={place.adapter === "memory" ? "accent" : "neutral"}>
            <span>{place.adapter}</span>
            <span className="opacity-60">{place.mode}</span>
          </Badge>
        )}
      </div>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {STORAGE_FACTS[storage].hint}
      </p>
    </div>
  </div>
);

/** All eight storages side by side, behind the Playground's disclosure. A table on a desk, a card per storage on a phone. */
export const StorageMatrix: React.FunctionComponent<StorageMatrixProps> = ({
  places,
}) => (
  <>
    <div className={`hidden overflow-x-auto md:block ${CARD_CLASS_NAME}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500 uppercase dark:text-zinc-400">
            <th scope="col" className="px-4 py-3 font-semibold">
              Storage
            </th>
            {FACT_COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-3 py-3 text-center font-semibold whitespace-nowrap"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800">
          {PLAYGROUND_STORAGES.map((storage) => (
            <tr
              key={storage}
              className="transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
            >
              <th scope="row" className="px-4 py-3 text-left font-normal">
                <StorageName storage={storage} place={places[storage]} />
              </th>
              {FACT_COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-3 text-center">
                  <Fact holds={STORAGE_FACTS[storage][column.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ul className="flex flex-col gap-3 md:hidden">
      {PLAYGROUND_STORAGES.map((storage) => (
        <li key={storage}>
          <article
            aria-label={STORAGE_LABELS[storage]}
            className={`flex flex-col gap-3 p-4 ${CARD_CLASS_NAME}`}
          >
            <StorageName storage={storage} place={places[storage]} />
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {FACT_COLUMNS.map((column) => (
                <div key={column.key} className="flex items-center gap-2">
                  <dd className="w-4 text-center">
                    <Fact holds={STORAGE_FACTS[storage][column.key]} />
                  </dd>
                  <dt className="text-zinc-600 dark:text-zinc-400">
                    {column.label}
                  </dt>
                </div>
              ))}
            </dl>
          </article>
        </li>
      ))}
    </ul>
  </>
);
