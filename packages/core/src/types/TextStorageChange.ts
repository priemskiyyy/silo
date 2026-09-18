import type { StorageChange } from "src/types/StorageChange";

/**
 * One change a text backend observed from outside this store, before decoding:
 * the raw text under a key, absent as `null` or `undefined`, or `{ key: null }`
 * for everything changed. Read failures carry `error: { cause }`.
 *
 * @example
 * ```ts
 * listener({ key: event.key, text: event.newValue });
 * ```
 */
export type TextStorageChange =
  | { key: string; text: string | null | undefined }
  | { key: null }
  | Extract<StorageChange, { error: unknown }>;
