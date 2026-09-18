import { getContext } from "svelte";
import type { SiloValue } from "@priemskiyyy/silo";
import { useObservableValue } from "./internal/useObservableValue.svelte.js";
import { SILO_CONTEXT } from "../context/SiloContext.js";
import type { SiloContextValue } from "../context/SiloContext.js";
import type { RegisteredKey, RegisteredValue } from "../types/Register.js";

/**
 * Reads and writes through `.current`. Pass a getter for a changing key.
 * Pass a value handle to choose a scope explicitly without a provider.
 * @example `const theme = useValue("theme"); theme.current = "dark";`
 */
// Overloads infer the value from a handle or from the registered schema key.
export function useValue<TValue>(
  source: SiloValue<TValue> | (() => SiloValue<TValue>),
  onChange?: (value: TValue) => void | Promise<unknown>,
): { current: TValue };
export function useValue<TKey extends RegisteredKey>(
  source: TKey | (() => TKey),
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): { current: RegisteredValue<TKey> };
export function useValue<TKey extends RegisteredKey>(
  source:
    | TKey
    | SiloValue<RegisteredValue<TKey>>
    | (() => TKey | SiloValue<RegisteredValue<TKey>>),
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): { current: RegisteredValue<TKey> } {
  const context = getContext<SiloContextValue | undefined>(SILO_CONTEXT);
  const value = $derived.by(() => {
    const current = typeof source === "function" ? source() : source;
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current;
    }
    if (context === undefined) {
      throw new Error("Silo utilities must be used within a SiloProvider.");
    }
    return context.scope.current.value(current);
  });
  const snapshot = useObservableValue(() => value, onChange);
  return {
    get current() {
      return snapshot.current;
    },
    set current(next) {
      value.set(next);
    },
  };
}
