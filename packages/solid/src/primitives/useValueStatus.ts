import type { Accessor } from "solid-js";
import type { ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { useScope } from "src/primitives/useScope";
import type { RegisteredKey } from "src/types/Register";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  key: RegisteredKey | Accessor<RegisteredKey>,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const scope = useScope();
  return useObservableValue(
    () => scope().value(typeof key === "function" ? key() : key).status,
    onChange,
  );
};
