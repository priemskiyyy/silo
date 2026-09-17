import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Accessor } from "solid-js";
import type { ObservableValue } from "@priemskiyyy/silo";

export const useObservableValue = <TValue>(
  observable: Accessor<ObservableValue<TValue>>,
  onChange?: (value: TValue) => void | Promise<unknown>,
): Accessor<TValue> => {
  const current = createMemo(observable);
  const [track, notify] = createSignal(undefined, { equals: false });
  createEffect(() => {
    const value = current();
    onCleanup(value.subscribe(() => notify()));
    if (typeof onChange === "function") {
      onCleanup(value.subscribe(() => onChange(value.get())));
    }
    // Recheck changes between the render and subscription.
    notify();
  });
  return () => {
    track();
    return current().get();
  };
};
