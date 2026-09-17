import { useContext } from "solid-js";
import { SiloContext } from "src/context/SiloContext";

export const useSiloContext = () => {
  const context = useContext(SiloContext);
  if (context === undefined) {
    throw new Error("Silo primitives must be used within a SiloProvider.");
  }
  return context;
};
