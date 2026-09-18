import { createStorageAdapter } from "@priemskiyyy/silo";
import type { TauriStoreAdapterOptions } from "src/types/TauriStoreAdapterOptions";

/**
 * Wraps a Tauri Store or LazyStore and observes its changes.
 * The application configures autosave and owns the file.
 *
 * @example
 * ```ts
 * const adapter = tauriStore({ store: await Store.load("state.json") });
 * ```
 */
export const tauriStore = ({
  store,
  available = () => true,
}: TauriStoreAdapterOptions) => {
  const stops = new Set<() => void>();

  return createStorageAdapter({
    mode: "async",
    name: "tauri-store",
    native: store,
    get: (key) => store.get(key),
    set: async (key, value) => {
      if (value === undefined) {
        await store.delete(key);
        return;
      }

      await store.set(key, value);
    },
    remove: async (key) => {
      await store.delete(key);
    },
    keys: () => store.keys(),
    available,
    dispose: () => {
      for (const stop of [...stops]) {
        stop();
      }
    },
    observe: (listener) => {
      let stopped = false;
      // IPC registration may finish after stop() or dispose().
      const unlisten = store
        .onChange((key, value) => {
          if (stopped) {
            return;
          }

          listener({ key, value });
        })
        .catch((cause: unknown) => {
          if (stopped) {
            return;
          }
          listener({ key: null, error: { cause } });
        });
      const stop = () => {
        if (stopped) {
          return;
        }

        stopped = true;
        stops.delete(stop);
        unlisten.then((release) => release?.());
      };

      stops.add(stop);

      return stop;
    },
  });
};
