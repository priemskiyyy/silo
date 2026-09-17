import { computed } from "vue";
import { useSiloContext } from "src/composables/internal/useSiloContext";

/** Follows the provider's scope. @example `await useScope().value.clear();` */
export const useScope = () => {
  const context = useSiloContext();
  return computed(() => context.value.scope);
};
