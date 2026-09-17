import { createStorageAdapter } from "@priemskiyyy/silo";
import type { ChromeStorageAdapterOptions } from "src/types/ChromeStorageAdapterOptions";
import type { ChromeStorageArea } from "src/types/ChromeStorageArea";

type ChangeListener = Parameters<
  ChromeStorageArea["onChanged"]["addListener"]
>[0];

/**
 * Stores values in a Chrome storage area and observes its changes.
 *
 * @example
 * ```ts
 * const adapter = chromeStorage({ area: chrome.storage.local });
 * ```
 */
export const chromeStorage = ({
  area,
  available = () => true,
}: ChromeStorageAdapterOptions) => {
  const stops = new Set<() => void>();

  return createStorageAdapter({
    mode: "async",
    name: "chrome-storage",
    native: area,
    get: async (key) => {
      const items = await area.get(key);

      return Object.hasOwn(items, key) ? items[key] : undefined;
    },
    set: (key, value) => {
      if (value === undefined) {
        return area.remove(key);
      }

      return area.set({ [key]: value });
    },
    remove: (key) => area.remove(key),
    keys: async () => Object.keys(await area.get(null)),
    available,
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }
    },
    observe: (listener) => {
      const handleChanges: ChangeListener = (changes) => {
        for (const [key, change] of Object.entries(changes)) {
          listener({ key, value: change.newValue });
        }
      };
      const stop = () => {
        if (!stops.delete(stop)) {
          return;
        }

        area.onChanged.removeListener(handleChanges);
      };

      area.onChanged.addListener(handleChanges);
      stops.add(stop);

      return stop;
    },
  });
};
