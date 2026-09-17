/**
 * AsyncStorage methods used by the adapter.
 *
 * @example
 * ```ts
 * import AsyncStorage from "@react-native-async-storage/async-storage";
 *
 * const storage: AsyncStorageInstance = AsyncStorage;
 * ```
 */
export type AsyncStorageInstance = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<Iterable<string>>;
};
