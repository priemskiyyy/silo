import { useMemo, useSyncExternalStore } from "react";
import type { RegisteredKey, RegisteredValue } from "@priemskiyyy/silo-react";
import { useSilo } from "@priemskiyyy/silo-react";

/**
 * A value at the root scope from inside a scoped provider: the URL keys and
 * the preferences belong to the page, not to the notebook on screen.
 */
export const useRootValue = <TKey extends RegisteredKey>(
  key: TKey,
): [RegisteredValue<TKey>, (value: RegisteredValue<TKey>) => void] => {
  const silo = useSilo();
  const value = useMemo(() => silo.value(key), [silo, key]);

  return [useSyncExternalStore(value.subscribe, value.get), value.set];
};
