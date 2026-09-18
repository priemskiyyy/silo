import type { SiloValue } from "@priemskiyyy/silo";
import { createMemo, untrack, useContext } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { SiloContext } from "src/context/SiloContext";
import type { RegisteredKey, RegisteredValue } from "src/types/Register";

const isUpdater = <TValue>(
  next: TValue | ((previous: TValue) => TValue),
): next is (previous: TValue) => TValue => typeof next === "function";

/**
 * Reads a stored value and returns a setter accepting a value or an updater.
 * The setter follows the current key and scope and returns the resolved value.
 * Wrap function values: `setValue(() => fn)`.
 * Pass a value handle to choose a scope explicitly without a provider.
 * @example `const [theme, setTheme] = useValue(() => props.themeKey);`
 */
// Overloads infer the value from a handle or from the registered schema key.
export function useValue<TValue>(
  source: SiloValue<TValue> | Accessor<SiloValue<TValue>>,
  onChange?: (value: TValue) => void | Promise<unknown>,
): [Accessor<TValue>, (value: Parameters<Setter<TValue>>[0]) => TValue];
export function useValue<TKey extends RegisteredKey>(
  source: TKey | Accessor<TKey>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [
  Accessor<RegisteredValue<TKey>>,
  (
    value: Parameters<Setter<RegisteredValue<TKey>>>[0],
  ) => RegisteredValue<TKey>,
];
export function useValue<TKey extends RegisteredKey>(
  source:
    | TKey
    | SiloValue<RegisteredValue<TKey>>
    | Accessor<TKey | SiloValue<RegisteredValue<TKey>>>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [
  Accessor<RegisteredValue<TKey>>,
  (
    value: Parameters<Setter<RegisteredValue<TKey>>>[0],
  ) => RegisteredValue<TKey>,
] {
  const context = useContext(SiloContext);
  const value = createMemo(() => {
    const current = typeof source === "function" ? source() : source;
    if (current === undefined || current === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof current !== "string") {
      return current;
    }
    if (context === undefined) {
      throw new Error("Silo primitives must be used within a SiloProvider.");
    }
    return context.scope().value(current);
  });
  return [
    useObservableValue(value, onChange),
    (next) =>
      untrack(() => {
        const current = value();

        if (isUpdater<RegisteredValue<TKey>>(next)) {
          const updated = next(current.get());
          current.set(updated);
          return updated;
        }

        current.set(next);
        return next;
      }),
  ];
}
