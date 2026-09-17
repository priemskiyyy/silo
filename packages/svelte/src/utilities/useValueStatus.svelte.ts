import type { ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { useScope } from "./useScope.js";
import type { RegisteredKey } from "../types/Register.js";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  key: RegisteredKey | (() => RegisteredKey),
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const scope = useScope();
  return useObservableValue(
    () => scope.current.value(typeof key === "function" ? key() : key).status,
    onChange,
  );
};
