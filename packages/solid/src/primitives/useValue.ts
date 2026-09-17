import { createMemo, untrack } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { useObservableValue } from "src/primitives/internal/useObservableValue";
import { useScope } from "src/primitives/useScope";
import type { RegisteredKey, RegisteredValue } from "src/types/Register";

const isUpdater = <TValue>(
  next: TValue | ((previous: TValue) => TValue),
): next is (previous: TValue) => TValue => typeof next === "function";

/**
 * Reads a stored value and returns a setter accepting a value or an updater.
 * The setter follows the current key and scope and returns the resolved value.
 * Wrap function values: `setValue(() => fn)`.
 * @example `const [theme, setTheme] = useValue(() => props.themeKey);`
 */
export const useValue = <TKey extends RegisteredKey>(
  key: TKey | Accessor<TKey>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [
  Accessor<RegisteredValue<TKey>>,
  (
    value: Parameters<Setter<RegisteredValue<TKey>>>[0],
  ) => RegisteredValue<TKey>,
] => {
  const scope = useScope();
  const value = createMemo(() =>
    scope().value(typeof key === "function" ? key() : key),
  );
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
};
