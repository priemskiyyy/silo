import type { Accessor } from "solid-js";
import { useSilo } from "src/primitives/useSilo";
import type { RegisteredNativeStorage } from "src/types/Register";

/** Follows the provider's native storage handles. @example `const native = useNativeStorage();` */
export const useNativeStorage = (): Accessor<RegisteredNativeStorage> => {
  const silo = useSilo();
  return () => silo().native;
};
