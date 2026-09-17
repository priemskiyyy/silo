/**
 * The unstorage methods used by the adapter.
 *
 * @example
 * ```ts
 * const storage: UnstorageInstance = createStorage({ driver: fsDriver({ base: "./data" }) });
 * ```
 */
export type UnstorageInstance = {
  hasItem(key: string): Promise<boolean>;
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys(): Promise<string[]>;
};
