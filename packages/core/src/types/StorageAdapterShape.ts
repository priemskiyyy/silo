import type { KeyspaceDeclaration } from "src/types/KeyspaceDeclaration";
import type { StorageChange } from "src/types/StorageChange";

/**
 * The one shape both adapter contracts are instances of, parameterized by
 * everything the two differ in: the mode discriminant and what `get`, the
 * writes and `keys` answer with. `available` and `dispose` are synchronous on
 * both, because the core chooses an adapter before anything is read and
 * releases one from a teardown path that cannot await.
 */
export type StorageAdapterShape<
  TMode extends "sync" | "async",
  TNative,
  TRead,
  TWrite,
  TKeys,
> = {
  mode: TMode;
  name: string;
  native: TNative;
  get(key: string): TRead;
  set(key: string, value: unknown): TWrite;
  remove(key: string): TWrite;
  keys?(): TKeys;
  available(): boolean;
  /** How this medium wants the store's namespace; absent means `visible`. */
  keyspace?: KeyspaceDeclaration;
  dispose(): void;
  observe?(listener: (change: StorageChange) => void): () => void;
};
