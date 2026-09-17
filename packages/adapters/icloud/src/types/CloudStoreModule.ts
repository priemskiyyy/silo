/**
 * iCloud storage and remote notification methods used by the adapter.
 *
 * @example
 * ```ts
 * import * as CloudStore from "react-native-cloud-store";
 *
 * const store: CloudStoreModule = CloudStore;
 * ```
 */
export type CloudStoreModule = {
  kvGetItem(key: string): Promise<string | undefined>;
  kvSetItem(key: string, value: string): Promise<void>;
  kvRemoveItem(key: string): Promise<void>;
  kvGetAllItems(): Promise<Record<string, string>>;
  /** Starts the native notification; `undefined` when it was already started. */
  registerKVStoreRemoteChangedEvent(): { remove(): void } | undefined;
  onKVStoreRemoteChanged(
    listener: (data: { reason: number; changedKeys?: string[] }) => void,
  ): { remove(): void };
};
