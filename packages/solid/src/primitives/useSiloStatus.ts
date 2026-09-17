import type { SiloStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { useSilo } from "src/primitives/useSilo";

/** Observes migration status. @example `const status = useSiloStatus();` */
export const useSiloStatus = (
  onChange?: (status: SiloStatus) => void | Promise<unknown>,
) => {
  const silo = useSilo();
  return useObservableValue(() => silo().status, onChange);
};
