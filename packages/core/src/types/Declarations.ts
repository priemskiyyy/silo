import type { Storages } from "src/types/Storages";

type UnionToIntersection<TUnion> = (
  TUnion extends unknown ? (member: TUnion) => void : never
) extends (member: infer TIntersection) => void
  ? TIntersection
  : never;

/**
 * Every declaration of a store, as one flat map from the path a value is
 * addressed by to its definition: the default storage's keys bare, every other
 * storage's as `storage.key`.
 *
 * @example
 * ```ts
 * type Declared = Declarations<typeof storages>; // { theme: ValueDefinition<Theme, Theme>; "secure.token": ValueDefinition<string, undefined> }
 * ```
 */
export type Declarations<TStorages extends Storages> =
  TStorages["default"]["schema"] &
    UnionToIntersection<
      {
        [TName in Exclude<keyof TStorages, "default"> & string]: {
          [
            TKey in keyof TStorages[TName]["schema"] &
              string as `${TName}.${TKey}`
          ]: TStorages[TName]["schema"][TKey];
        };
      }[Exclude<keyof TStorages, "default"> & string]
    >;
