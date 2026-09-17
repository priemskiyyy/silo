import type { CloudStoreModule } from "src/types/CloudStoreModule";

type RemoteChange = Parameters<
  Parameters<CloudStoreModule["onKVStoreRemoteChanged"]>[0]
>[0];

/**
 * An in-process stand-in for the `react-native-cloud-store` module, for the
 * tests: strings in a `Map`, and a remote change the test raises by hand,
 * because the real platform raises it only for changes received from iCloud.
 */
export const createFakeCloudStore = () => {
  const store = new Map<string, string>();
  const listeners = new Set<(data: RemoteChange) => void>();
  let registered = 0;

  const module: CloudStoreModule = {
    kvGetItem: async (key) => store.get(key),
    kvSetItem: async (key, value) => {
      store.set(key, value);
    },
    kvRemoveItem: async (key) => {
      store.delete(key);
    },
    kvGetAllItems: async () => Object.fromEntries(store),
    registerKVStoreRemoteChangedEvent: () => {
      if (registered > 0) {
        return undefined;
      }

      registered += 1;

      return {
        remove: () => {
          registered -= 1;
        },
      };
    },
    onKVStoreRemoteChanged: (listener) => {
      listeners.add(listener);

      return {
        remove: () => {
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    store,
    module,
    listeners,
    /** Whether the native notification is switched on right now. */
    registered: () => registered > 0,
    /** What iCloud does when another device wrote: the store changes, then the app is told which keys. */
    remote: (data: RemoteChange) => {
      for (const listener of [...listeners]) {
        listener(data);
      }
    },
  };
};
