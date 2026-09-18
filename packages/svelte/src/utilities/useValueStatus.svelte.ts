import { getContext } from "svelte";
import type { SiloValue, ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { SILO_CONTEXT } from "../context/SiloContext.js";
import type { SiloContextValue } from "../context/SiloContext.js";
import type { RegisteredKey } from "../types/Register.js";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  source:
    | RegisteredKey
    | Pick<SiloValue<unknown>, "status">
    | (() => RegisteredKey | Pick<SiloValue<unknown>, "status">),
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const context = getContext<SiloContextValue | undefined>(SILO_CONTEXT);
  return useObservableValue(() => {
    const current = typeof source === "function" ? source() : source;
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current.status;
    }
    if (context === undefined) {
      throw new Error("Silo utilities must be used within a SiloProvider.");
    }
    return context.scope.current.value(current).status;
  }, onChange);
};
