import { toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { ValueStatus } from "@priemskiyyy/silo";
import { useObservableValue } from "src/composables/internal/useObservableValue";
import { useScope } from "src/composables/useScope";
import type { RegisteredKey } from "src/types/Register";

/** Observes status without subscribing to value snapshots. @example `const status = useValueStatus("theme");` */
export const useValueStatus = (
  key: MaybeRefOrGetter<RegisteredKey>,
  onChange?: (status: ValueStatus) => void | Promise<unknown>,
) => {
  const scope = useScope();
  return useObservableValue(
    () => scope.value.value(toValue(key)).status,
    onChange,
  );
};
