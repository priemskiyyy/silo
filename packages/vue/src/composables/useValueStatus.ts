import { inject, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { SiloValue, ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/composables/internal/useObservableValue";
import { SILO_CONTEXT } from "src/context/SiloContext";
import type { RegisteredKey } from "src/types/Register";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  source: MaybeRefOrGetter<RegisteredKey | Pick<SiloValue<unknown>, "status">>,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const context = inject(SILO_CONTEXT, undefined);
  return useObservableValue(() => {
    const current = toValue(source);
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current.status;
    }
    if (context === undefined) {
      throw new Error("Silo composables must be used within a SiloProvider.");
    }
    return context.value.scope.value(current).status;
  }, onChange);
};
