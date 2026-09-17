import { useSilo } from "./useSilo.js";
import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredNativeStorage } from "../types/Register.js";

/** Follows the provider's native storage handles. @example `const native = useNativeStorage();` */
export const useNativeStorage = (): ReadableValue<RegisteredNativeStorage> => {
  const silo = useSilo();
  return {
    get current() {
      return silo.current.native;
    },
  };
};
