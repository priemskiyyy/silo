import type { Declarations } from "src/types/Declarations";
import type { Storages } from "src/types/Storages";

/**
 * Every key a store can address: the default storage's bare, and every other
 * storage's as `storage.key`.
 *
 * @example
 * ```ts
 * type Key = KeyOf<typeof storages>; // "theme" | "secure.token"
 * ```
 */
export type KeyOf<TStorages extends Storages> = keyof Declarations<TStorages> &
  string;
