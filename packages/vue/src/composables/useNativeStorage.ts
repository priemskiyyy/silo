import { computed } from "vue";
import type { ComputedRef } from "vue";
import { useSilo } from "src/composables/useSilo";
import type { RegisteredNativeStorage } from "src/types/Register";

/** Follows the provider's native storage handles. @example `const native = useNativeStorage();` */
export const useNativeStorage = (): ComputedRef<RegisteredNativeStorage> => {
  const silo = useSilo();
  return computed(() => silo.value.native);
};
