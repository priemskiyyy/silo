import { useMemo } from "react";
import type { ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { useScope } from "src/hooks/useScope";
import type { RegisteredKey } from "src/types/Register";

// Interned so every call hands React the same reference, the way the core
// interns the statuses its own stores dedupe on.
const HYDRATING_VALUE_STATUS = { state: "hydrating" } satisfies ValueStatus;

const getServerValueStatus = () => HYDRATING_VALUE_STATUS;

/**
 * Observes one value's progress without reading the value. Nothing here
 * subscribes to the snapshot, so a component that only watches status does not
 * rerender when the value changes, and `error.phase` says which side failed.
 *
 * @example
 * ```ts
 * const status = useValueStatus("user");
 *
 * if (status.state === "hydrating") return <Spinner />;
 * ```
 */
export const useValueStatus = (
  key: RegisteredKey,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
): ValueStatus => {
  const scope = useScope();

  const status = useMemo(() => scope.value(key).status, [scope, key]);

  return useObservableValue(status, getServerValueStatus, onChange);
};
