import { useSiloContext } from "src/primitives/internal/useSiloContext";

/** Follows the current provider's Silo. @example `await useSilo()().flush();` */
export const useSilo = () => useSiloContext().silo;
