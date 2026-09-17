import type React from "react";
import { Minus, Package, Plus } from "@phosphor-icons/react";
import { useValue } from "@priemskiyyy/silo-react";
import { Panel } from "src/components/Panel/Panel";
import { SUPPLY_ITEMS, formatQuantity } from "src/formatting/formatQuantity";
import type { SupplyItem } from "src/formatting/formatQuantity";
import { useRootValue } from "src/hooks/useRootValue";
import { buttonStyles } from "src/styles/buttonStyles";
import type { Place } from "src/utils/describeStorages";

type SuppliesPanelProps = {
  livesIn: Place[];
};

const STEPS: Record<SupplyItem, number> = { water: 5, fuel: 10, rations: 1 };

/** A `Map` in IndexedDB, scoped to the notebook; the unit comes from the cookie preference. */
export const SuppliesPanel: React.FunctionComponent<SuppliesPanelProps> = ({
  livesIn,
}) => {
  const [supplies, setSupplies] = useValue("journal.supplies");
  const [units] = useRootValue("preferences.units");

  const handleAdjust = (item: SupplyItem, direction: 1 | -1) => {
    const next = new Map(supplies);
    next.set(
      item,
      Math.max(0, (supplies.get(item) ?? 0) + direction * STEPS[item]),
    );
    setSupplies(next);
  };

  return (
    <Panel
      title="Supplies"
      icon={Package}
      shows="A Map kept as a structured clone, its unit read from a cookie."
      livesIn={livesIn}
    >
      <ul className="flex flex-col gap-(--row-gap)">
        {SUPPLY_ITEMS.map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-xl border border-zinc-200/80 px-3 py-2 dark:border-zinc-800"
          >
            <span className="flex-1 text-sm font-medium capitalize">
              {item}
            </span>
            <span className="font-mono text-sm tabular-nums">
              {formatQuantity(item, supplies.get(item) ?? 0, units)}
            </span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => handleAdjust(item, -1)}
              className={buttonStyles({ size: "icon" })}
            >
              <Minus size={14} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Add ${item}`}
              onClick={() => handleAdjust(item, 1)}
              className={buttonStyles({ size: "icon" })}
            >
              <Plus size={14} weight="bold" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
};
