import type { Units } from "src/silo/createFieldbookSilo";

export const SUPPLY_ITEMS = ["water", "fuel", "rations"] as const;

export type SupplyItem = (typeof SUPPLY_ITEMS)[number];

const LITERS_PER_GALLON = 3.785;

// Stored in liters and counts; the cookie preference only changes the label.
const FORMATS: Record<SupplyItem, Record<Units, (amount: number) => string>> = {
  water: {
    metric: (amount) => `${amount} L`,
    imperial: (amount) => `${(amount / LITERS_PER_GALLON).toFixed(1)} gal`,
  },
  fuel: {
    metric: (amount) => `${amount} L`,
    imperial: (amount) => `${(amount / LITERS_PER_GALLON).toFixed(1)} gal`,
  },
  rations: {
    metric: (amount) => `${amount} packs`,
    imperial: (amount) => `${amount} packs`,
  },
};

export const formatQuantity = (
  item: SupplyItem,
  amount: number,
  units: Units,
) => FORMATS[item][units](amount);
