import { useSiloContext } from "./internal/useSiloContext.js";

/** Follows the current provider's Silo. @example `await useSilo().current.flush();` */
export const useSilo = () => useSiloContext().silo;
