import { customRef, onMounted, onWatcherCleanup, toRef, watch } from "vue";
import type { ObservableValue } from "@priemskiyyy/silo";

export const useObservableValue = <TValue>(
  observable: () => ObservableValue<TValue>,
  onChange?: (value: TValue) => void | Promise<unknown>,
) => {
  const snapshot = customRef<TValue>((track, trigger) => {
    onMounted(() => {
      watch(
        observable,
        (current) => {
          onWatcherCleanup(current.subscribe(trigger));
          if (typeof onChange === "function") {
            onWatcherCleanup(current.subscribe(() => onChange(current.get())));
          }
          // Recheck changes between the render and subscription.
          trigger();
        },
        { immediate: true, flush: "sync" },
      );
    });
    return {
      get: () => {
        track();
        return observable().get();
      },
      set: () => {},
    };
  });
  return toRef(() => snapshot.value);
};
