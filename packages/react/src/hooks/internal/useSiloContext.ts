import { useContext } from "react";
import { SiloContext } from "src/context/SiloContext";
import type { SiloContextValue } from "src/context/SiloContext";

/**
 * The nearest provider's store and scope, or a throw naming the provider.
 *
 * @example
 * ```ts
 * const { silo, scope } = useSiloContext();
 * ```
 */
export const useSiloContext = (): SiloContextValue => {
  const context = useContext(SiloContext);

  if (context === undefined) {
    throw new Error("Silo hooks must be used within a SiloProvider.");
  }

  return context;
};
