import type { SiloStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/composables/internal/useObservableValue";
import { useSilo } from "src/composables/useSilo";

/** Observes migration status. @example `const status = useSiloStatus();` */
export const useSiloStatus = (
  onChange?: (status: SiloStatus) => void | Promise<unknown>,
) => {
  const silo = useSilo();
  return useObservableValue(() => silo.value.status, onChange);
};
