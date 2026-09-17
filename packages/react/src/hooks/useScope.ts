import { useSiloContext } from "src/hooks/internal/useSiloContext";
import type { RegisteredScope } from "src/types/Register";

/**
 * The scope the value hooks below the provider read under: the one its `scope`
 * prop names, or the store itself at the root. Reaching a scope reads nothing.
 *
 * @example
 * ```tsx
 * const account = useScope();
 *
 * return <button onClick={() => void account.clear()}>Sign out</button>;
 * ```
 */
export const useScope = (): RegisteredScope => useSiloContext().scope;
