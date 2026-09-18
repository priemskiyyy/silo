import { useContext, useMemo } from "react";
import type { SiloValue, ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { SiloContext } from "src/context/SiloContext";
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
  source: RegisteredKey | Pick<SiloValue<unknown>, "status">,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const context = useContext(SiloContext);
  const status = useMemo(() => {
    if (source === undefined || source === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof source !== "string") {
      return source.status;
    }
    if (context === undefined) {
      throw new Error("Silo hooks must be used within a SiloProvider.");
    }
    return context.scope.value(source).status;
  }, [context, source]);
  return useObservableValue(status, getServerValueStatus, onChange);
};
