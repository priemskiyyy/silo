import type { SiloValue } from "@priemskiyyy/silo";
import { useCallback, useContext, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useObservableValue } from "src/hooks/internal/useObservableValue";
import { SiloContext } from "src/context/SiloContext";
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
 * Pass a value handle to choose a scope explicitly without a provider.
 * @example
 * ```ts
 * const [theme, setTheme] = useValue("theme");
 *
 * return <button onClick={() => setTheme((previous) => previous === "dark" ? "light" : "dark")}>{theme}</button>;
 * ```
 */
// Overloads infer the value from a handle or from the registered schema key.
export function useValue<TValue>(
  source: SiloValue<TValue>,
  onChange?: (value: TValue) => void | Promise<unknown>,
): [TValue, Dispatch<SetStateAction<TValue>>];
export function useValue<TKey extends RegisteredKey>(
  source: TKey,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [RegisteredValue<TKey>, Dispatch<SetStateAction<RegisteredValue<TKey>>>];
export function useValue<TKey extends RegisteredKey>(
  source: TKey | SiloValue<RegisteredValue<TKey>>,
  onChange?: (value: RegisteredValue<TKey>) => void | Promise<unknown>,
): [RegisteredValue<TKey>, Dispatch<SetStateAction<RegisteredValue<TKey>>>] {
  const context = useContext(SiloContext);
  const value = useMemo(() => {
    if (source === undefined || source === null) {
      throw new Error("A Silo value handle or key is required.");
    }
    if (typeof source !== "string") {
      return source;
    }
    if (context === undefined) {
      throw new Error("Silo hooks must be used within a SiloProvider.");
    }
    return context.scope.value(source);
  }, [context, source]);
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
}
