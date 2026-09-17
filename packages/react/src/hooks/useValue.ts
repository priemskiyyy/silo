import { useCallback, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { useScope } from "src/hooks/useScope";
import type { RegisteredKey, RegisteredValue } from "src/types/Register";

const isUpdater = <TValue>(
  next: TValue | ((previous: TValue) => TValue),
): next is (previous: TValue) => TValue => typeof next === "function";

/**
 * Reads one stored value under the provider's scope and rerenders when it
 * changes. The setter accepts a value or an updater of the latest snapshot and
 * stays stable while the value handle is unchanged. `onChange` runs on subsequent
 * updates, including ones another tab made. Wrap function values: `setValue(() => fn)`.
 *
 * On a synchronous adapter the first render already carries the persisted
 * value. On an asynchronous one it carries the fallback until hydration lands,
 * which is also what a hydrating client renders; gate on `useValueStatus` when
 * that first frame matters.
 *
 * @example
 * ```ts
 * const [theme, setTheme] = useValue("theme");
 *
 * return <button onClick={() => setTheme((previous) => previous === "dark" ? "light" : "dark")}>{theme}</button>;
 * ```
 */
export const useValue = <TKey extends RegisteredKey>(
  key: TKey,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [RegisteredValue<TKey>, Dispatch<SetStateAction<RegisteredValue<TKey>>>] => {
  const scope = useScope();
  const value = useMemo(() => scope.value(key), [scope, key]);
  const snapshot = useObservableValue(value, value.get, onChange);
  const setValue: Dispatch<SetStateAction<RegisteredValue<TKey>>> = useCallback(
    (next) => {
      if (isUpdater(next)) {
        value.set(next(value.get()));
        return;
      }

      value.set(next);
    },
    [value],
  );

  return [snapshot, setValue];
};
