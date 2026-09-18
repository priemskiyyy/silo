import { useContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { SiloValue, ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { SiloContext } from "src/context/SiloContext";
import type { RegisteredKey } from "src/types/Register";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  source:
    | RegisteredKey
    | Pick<SiloValue<unknown>, "status">
    | Accessor<RegisteredKey | Pick<SiloValue<unknown>, "status">>,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const context = useContext(SiloContext);
  return useObservableValue(() => {
    const current = typeof source === "function" ? source() : source;
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current.status;
    }
    if (context === undefined) {
      throw new Error("Silo primitives must be used within a SiloProvider.");
    }
    return context.scope().value(current).status;
  }, onChange);
};
