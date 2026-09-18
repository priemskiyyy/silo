import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { MmkvAdapterOptions } from "src/types/MmkvAdapterOptions";

const alwaysAvailable = () => true;

/**
 * Stores JSON text through an MMKV v3 instance and observes its value changes.
 *
 * @example
 * ```ts
 * const adapter = mmkv({ storage: new MMKV({ id: "app" }) });
 * ```
 */
export const mmkv = ({
  storage,
  available = alwaysAvailable,
  format,
}: MmkvAdapterOptions) => {
  const stops = new Set<() => void>();

  return createTextStorageAdapter({
    mode: "sync",
    name: "mmkv",
    native: storage,
    format,
    read: (key) => storage.getString(key),
    write: (key, text) => storage.set(key, text),
    remove: (key) => storage.delete(key),
    keys: () => storage.getAllKeys(),
    available,
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }
    },
    observe: (listener) => {
      const subscription = storage.addOnValueChangedListener((key) => {
        let text;
        try {
          text = storage.getString(key);
        } catch (cause) {
          listener({ key, error: { cause } });
          return;
        }
        listener({ key, text });
      });
      const stop = () => {
        if (!stops.delete(stop)) {
          return;
        }

        subscription.remove();
      };

      stops.add(stop);

      return stop;
    },
  });
};
