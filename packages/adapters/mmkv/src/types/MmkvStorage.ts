/**
 * MMKV v3 methods used by the adapter.
 *
 * @example
 * ```ts
 * const storage: MmkvStorage = new MMKV({ id: "app" });
 * ```
 */
export type MmkvStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  getAllKeys(): string[];
  addOnValueChangedListener(listener: (key: string) => void): {
    remove(): void;
  };
};
