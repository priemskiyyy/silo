import type { Storages } from "@priemskiyyy/silo";
import { getWinningAdapter } from "src/utils/getWinningAdapter";

/** Where a value lives: the storage, and the adapter and mode that won its candidate list. */
export type Place = {
  storage: string;
  adapter: string;
  mode: "sync" | "async";
};

export const describeStorages = (storages: Storages): Record<string, Place> =>
  Object.fromEntries(
    Object.entries(storages).map(([storage, { adapters }]) => {
      const winner = getWinningAdapter(adapters);

      return [storage, { storage, adapter: winner.name, mode: winner.mode }];
    }),
  );
