import { useSiloContext } from "./internal/useSiloContext.js";

/** Follows the provider's scope. @example `await useScope().current.clear();` */
export const useScope = () => useSiloContext().scope;
