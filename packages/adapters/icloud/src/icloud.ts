import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { IcloudAdapterOptions } from "src/types/IcloudAdapterOptions";

const alwaysAvailable = () => true;

/**
 * Stores JSON text in iCloud and observes changes received from other devices.
 *
 * @example
 * ```ts
 * const adapter = icloud({ store: CloudStore, available: () => Platform.OS === "ios" });
 * ```
 */
export const icloud = ({
  store,
  available = alwaysAvailable,
  format,
}: IcloudAdapterOptions) => {
  const stops = new Set<() => void>();
  let registration: ReturnType<typeof store.registerKVStoreRemoteChangedEvent>;

  return createTextStorageAdapter({
    mode: "async",
    name: "icloud",
    native: store,
    format,
    read: (key) => store.kvGetItem(key),
    write: (key, text) => store.kvSetItem(key, text),
    remove: (key) => store.kvRemoveItem(key),
    keys: async () => Object.keys(await store.kvGetAllItems()),
    available,
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }

      registration?.remove();
      registration = undefined;
    },
    observe: (listener) => {
      if (registration === undefined) {
        registration = store.registerKVStoreRemoteChangedEvent();
      }

      let stopped = false;
      const report = (key: string) =>
        store.kvGetItem(key).then(
          (text) => {
            if (stopped) {
              return;
            }

            listener({ key, text });
          },
          () => undefined,
        );
      const subscription = store.onKVStoreRemoteChanged(({ changedKeys }) => {
        if (stopped) {
          return;
        }

        if (changedKeys === undefined) {
          listener({ key: null });
          return;
        }

        changedKeys.forEach(report);
      });
      const stop = () => {
        if (stopped) {
          return;
        }

        stopped = true;
        stops.delete(stop);
        subscription.remove();
      };

      stops.add(stop);

      return stop;
    },
  });
};
