import type { SiloValue } from "@priemskiyyy/silo";
import { computed, inject, toValue } from "vue";
import type { MaybeRefOrGetter, WritableComputedRef } from "vue";
import { useObservableValue } from "src/composables/internal/useObservableValue";
import { SILO_CONTEXT } from "src/context/SiloContext";
import type { RegisteredKey, RegisteredValue } from "src/types/Register";

/**
 * A writable ref over a stored value. Pass a ref or getter for a changing key.
 * Pass a value handle to choose a scope explicitly without a provider.
 * @example `const theme = useValue("theme"); theme.value = "dark";`
 */
// Overloads infer the value from a handle or from the registered schema key.
export function useValue<TValue>(
  source: MaybeRefOrGetter<SiloValue<TValue>>,
  onChange?: (value: TValue) => void | Promise<unknown>,
): WritableComputedRef<TValue>;
export function useValue<TKey extends RegisteredKey>(
  source: MaybeRefOrGetter<TKey>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): WritableComputedRef<RegisteredValue<TKey>>;
export function useValue<TKey extends RegisteredKey>(
  source: MaybeRefOrGetter<TKey | SiloValue<RegisteredValue<TKey>>>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): WritableComputedRef<RegisteredValue<TKey>> {
  const context = inject(SILO_CONTEXT, undefined);
  const value = computed(() => {
    const current = toValue(source);
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current;
    }
    if (context === undefined) {
      throw new Error("Silo composables must be used within a SiloProvider.");
    }
    return context.value.scope.value(current);
  });
  const snapshot = useObservableValue(() => value.value, onChange);
  return computed({
    get: () => snapshot.value,
    set: (next) => value.value.set(next),
  });
}
