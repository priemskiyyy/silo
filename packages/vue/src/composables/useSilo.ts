import { computed } from "vue";
import { useSiloContext } from "src/composables/internal/useSiloContext";

/** Returns the current provider's Silo as a computed ref. @example `await useSilo().value.flush();` */
export const useSilo = () => {
  const context = useSiloContext();
  return computed(() => context.value.silo);
};
