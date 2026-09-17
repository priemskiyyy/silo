type Listener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
) => void;

/**
 * The shared contract of Chrome local, sync and session storage areas.
 *
 * @example
 * ```ts
 * const adapter = chromeStorage({ area: chrome.storage.local });
 * ```
 */
export type ChromeStorageArea = {
  get: (keys: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  onChanged: {
    addListener: (listener: Listener) => void;
    removeListener: (listener: Listener) => void;
  };
};
