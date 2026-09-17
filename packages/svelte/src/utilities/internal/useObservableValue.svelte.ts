import { createSubscriber } from "svelte/reactivity";
import type { ObservableValue } from "@priemskiyyy/silo";
import type { ReadableValue } from "../../types/ReadableValue.js";

export const useObservableValue = <TValue>(
  observable: () => ObservableValue<TValue>,
  onChange?: (value: TValue) => void | Promise<unknown>,
): ReadableValue<TValue> => {
  const current = $derived.by(() => {
    const value = observable();
    return { value, subscribe: createSubscriber(value.subscribe) };
  });
  $effect(() => {
    if (typeof onChange !== "function") {
      return;
    }
    const value = current.value;
    return value.subscribe(() => onChange(value.get()));
  });
  return {
    get current() {
      current.subscribe();
      return current.value.get();
    },
  };
};
