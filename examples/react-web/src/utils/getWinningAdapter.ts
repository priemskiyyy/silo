import type { StorageAdapter } from "@priemskiyyy/silo";

/**
 * The candidate a store keeps, derived the way the core decides it: the first
 * whose probe passes, or the last regardless. The example owns the lists, so
 * it can say which one won without asking the store.
 */
export const getWinningAdapter = (adapters: StorageAdapter[]) => {
  const floor = adapters.at(-1);

  if (floor === undefined) {
    throw new Error("A storage needs at least one adapter.");
  }

  return adapters.slice(0, -1).find((adapter) => adapter.available()) ?? floor;
};
