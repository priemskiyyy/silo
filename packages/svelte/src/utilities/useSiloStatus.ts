import type { SiloStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { useSilo } from "./useSilo.js";

/** Observes migration status. @example `const status = useSiloStatus();` */
export const useSiloStatus = (
  onChange?: (status: SiloStatus) => void | Promise<unknown>,
) => {
  const silo = useSilo();
  return useObservableValue(() => silo.current.status, onChange);
};
