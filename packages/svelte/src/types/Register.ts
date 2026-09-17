import type {
  DefinitionOf,
  InferValue,
  KeyOf,
  Silo,
  SiloScope,
  Storages,
} from "@priemskiyyy/silo";

/**
 * Declaration-merging target that types every export of this package with the
 * application's store. Augment it once, next to the store:
 *
 * @example
 * ```ts
 * declare module "@priemskiyyy/silo-svelte" {
 *   interface Register {
 *     silo: typeof silo;
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/no-empty-object-type -- declaration merging needs an interface.
export interface Register {}

/** The registered store's storages, or untyped `Storages` when nothing is registered. */
export type RegisteredStorages = Register extends {
  silo: Silo<infer TStorages extends Storages>;
}
  ? TStorages
  : Storages;

/** The registered store, or an untyped `Silo` when nothing is registered. */
export type RegisteredSilo = Silo<RegisteredStorages>;

/** The native handles the registered store's storages carry, by storage name. */
export type RegisteredNativeStorage = RegisteredSilo["native"];

/** A scope of the registered store: the provider's, or the store itself at the root. */
export type RegisteredScope = SiloScope<RegisteredStorages>;

/** Every key the registered store addresses: the default storage's bare, others as `storage.key`. */
export type RegisteredKey = KeyOf<RegisteredStorages>;

/** What one key reads as: its value, plus `undefined` when it declares no fallback. */
export type RegisteredValue<TKey extends RegisteredKey> = InferValue<
  DefinitionOf<RegisteredStorages, TKey>
>;
