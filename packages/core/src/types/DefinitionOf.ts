import type { Declarations } from "src/types/Declarations";
import type { KeyOf } from "src/types/KeyOf";
import type { Storages } from "src/types/Storages";

/**
 * The definition behind one addressable key.
 *
 * @example
 * ```ts
 * type Token = DefinitionOf<typeof storages, "secure.token">; // ValueDefinition<string, undefined>
 * ```
 */
export type DefinitionOf<
  TStorages extends Storages,
  TKey extends KeyOf<TStorages>,
> = Declarations<TStorages>[TKey];
