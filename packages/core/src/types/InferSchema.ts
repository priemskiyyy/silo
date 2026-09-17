import type { Declarations } from "src/types/Declarations";
import type { InferValue } from "src/types/InferValue";
import type { Storages } from "src/types/Storages";

/**
 * Every key a store addresses, mapped to the type it reads as.
 *
 * @example
 * ```ts
 * type Values = InferSchema<typeof storages>; // { theme: Theme; "secure.token": string | undefined }
 * ```
 */
export type InferSchema<TStorages extends Storages> = {
  [TKey in keyof Declarations<TStorages>]: InferValue<
    Declarations<TStorages>[TKey]
  >;
};
