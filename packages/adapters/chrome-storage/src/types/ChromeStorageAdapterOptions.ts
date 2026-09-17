import type { ChromeStorageArea } from "src/types/ChromeStorageArea";

/**
 * Options for `chromeStorage()`.
 *
 * @example
 * ```ts
 * const adapter = chromeStorage({ area: chrome.storage.sync, available: () => navigator.onLine });
 * ```
 */
export type ChromeStorageAdapterOptions = {
  area: ChromeStorageArea;
  available?: () => boolean;
};
