import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { useScope } from "./useScope.js";
import type { RegisteredKey, RegisteredValue } from "../types/Register.js";

/**
 * Reads and writes through `.current`. Pass a getter for a changing key.
 * @example `const theme = useValue("theme"); theme.current = "dark";`
 */
export const useValue = <TKey extends RegisteredKey>(
  key: TKey | (() => TKey),
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): { current: RegisteredValue<TKey> } => {
  const scope = useScope();
  const value = $derived(
    scope.current.value(typeof key === "function" ? key() : key),
  );
  const snapshot = useObservableValue(() => value, onChange);
  return {
    get current() {
      return snapshot.current;
    },
    set current(next) {
      value.set(next);
    },
  };
};
