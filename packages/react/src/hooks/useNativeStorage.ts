import { useSilo } from "src/hooks/useSilo";
import type { RegisteredNativeStorage } from "src/types/Register";

/**
 * The adapter's own storage handle, identity stable for the adapter's life. Its
 * type comes from the registered store, for example `Storage | null`, and is
 * `unknown` until `Register` is augmented.
 *
 * @example
 * ```ts
 * const storage = useNativeStorage();
 * const raw = storage?.getItem("silo:theme");
 * ```
 */
export const useNativeStorage = (): RegisteredNativeStorage => useSilo().native;
