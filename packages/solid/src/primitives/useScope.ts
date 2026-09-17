import { useSiloContext } from "src/primitives/internal/useSiloContext";

/** Follows the provider's scope. @example `await useScope()().clear();` */
export const useScope = () => useSiloContext().scope;
