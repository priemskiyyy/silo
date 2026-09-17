import { useSiloContext } from "src/hooks/internal/useSiloContext";
import type { RegisteredSilo } from "src/types/Register";

/**
 * Returns the nearest provider's store and throws when the provider is missing.
 * Augment `Register` to type it; see [[Register]].
 *
 * @example
 * ```ts
 * const silo = useSilo();
 * await silo.flush();
 * ```
 */
export const useSilo = (): RegisteredSilo => useSiloContext().silo;
