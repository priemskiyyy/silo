import { computed, toValue } from "vue";
import type { MaybeRefOrGetter, WritableComputedRef } from "vue";
import { useObservableValue } from "src/composables/internal/useObservableValue";
import { useScope } from "src/composables/useScope";
import type { RegisteredKey, RegisteredValue } from "src/types/Register";

/**
 * A writable ref over a stored value. Pass a ref or getter for a changing key.
 * @example `const theme = useValue("theme"); theme.value = "dark";`
 */
export const useValue = <TKey extends RegisteredKey>(
  key: MaybeRefOrGetter<TKey>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): WritableComputedRef<RegisteredValue<TKey>> => {
  const scope = useScope();
  const value = computed(() => scope.value.value(toValue(key)));
  const snapshot = useObservableValue(() => value.value, onChange);
  return computed({
    get: () => snapshot.value,
    set: (next) => value.value.set(next),
  });
};
