import type { StorageAdapterShape } from "src/types/StorageAdapterShape";
import type { TextFormat } from "src/types/TextFormat";
import type { TextStorageChange } from "src/types/TextStorageChange";

/**
 * The one shape both text mappings are instances of: a backend that holds
 * strings, described by `read`, `write` and `remove` over text. The adapter
 * built on it owns the JSON on both sides. `keys`, `available`, `dispose` and
 * `observe` mean what they mean on the adapter contract, with `observe`
 * reporting text. `format` replaces JSON for a backend whose values need
 * more than JSON can spell.
 */
export type TextStorageMappingShape<
  TMode extends "sync" | "async",
  TNative,
  TRead,
  TWrite,
  TKeys,
> = Omit<
  StorageAdapterShape<TMode, TNative, TRead, TWrite, TKeys>,
  "get" | "set" | "observe"
> & {
  // `| undefined` on purpose: an adapter forwards its own optional `format`
  // as it is, without a conditional spread at every call site.
  format?: TextFormat | undefined;
  read(key: string): TRead;
  write(key: string, text: string): TWrite;
  observe?(listener: (change: TextStorageChange) => void): () => void;
};
