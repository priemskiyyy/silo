import { inject } from "vue";
import { SILO_CONTEXT } from "src/context/SiloContext";

export const useSiloContext = () => {
  const context = inject(SILO_CONTEXT);
  if (context === undefined) {
    throw new Error("Silo composables must be used within a SiloProvider.");
  }
  return context;
};
