import type React from "react";
import { Check, Minus } from "@phosphor-icons/react";
import { FACT_COLUMNS, STORAGE_FACTS } from "src/silo/playground";
import type { PlaygroundStorage } from "src/silo/playground";
import { factStyles } from "src/styles/factStyles";

type StorageFactsProps = {
  storage: PlaygroundStorage;
};

/** The matrix, one storage at a time: five facts as pills and the hint, on one line where it fits. */
export const StorageFacts: React.FunctionComponent<StorageFactsProps> = ({
  storage,
}) => {
  const facts = STORAGE_FACTS[storage];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <ul aria-label="Facts" className="flex flex-wrap gap-1.5">
        {FACT_COLUMNS.map((column) => (
          <li
            key={column.key}
            className={factStyles({ holds: facts[column.key] })}
          >
            {facts[column.key] ? (
              <Check size={12} weight="bold" aria-label="yes" />
            ) : (
              <Minus size={12} aria-label="no" />
            )}
            {column.label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{facts.hint}</p>
    </div>
  );
};
