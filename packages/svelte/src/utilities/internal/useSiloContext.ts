import { getContext } from "svelte";
import { SILO_CONTEXT } from "../../context/SiloContext.js";
import type { SiloContextValue } from "../../context/SiloContext.js";

export const useSiloContext = () => {
  const context = getContext<SiloContextValue | undefined>(SILO_CONTEXT);
  if (context === undefined) {
    throw new Error("Silo utilities must be used within a SiloProvider.");
  }
  return context;
};
