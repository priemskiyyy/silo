import type { SiloStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { useSilo } from "src/hooks/useSilo";

// Interned for the same reason the value status is: one reference per render.
const MIGRATING_SILO_STATUS = { state: "migrating" } satisfies SiloStatus;

const getServerSiloStatus = () => MIGRATING_SILO_STATUS;

/**
 * Observes the store itself: `migrating` while migrations run, then `ready`, or
 * `error` with the migration that failed. On the server and the hydrating
 * render it reads `migrating`, which is what makes it safe to gate on.
 *
 * @example
 * ```ts
 * const status = useSiloStatus();
 *
 * if (status.state === "error") return <p>Storage needs attention.</p>;
 * ```
 */
export const useSiloStatus = (
  onChange?: (status: SiloStatus) => void | Promise<unknown>,
): SiloStatus => {
  const silo = useSilo();

  return useObservableValue(silo.status, getServerSiloStatus, onChange);
};
