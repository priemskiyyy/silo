import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { StorageAdapterShape } from "src/types/StorageAdapterShape";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";

// Overloaded signatures preserve mode and native types without a cast.
type CreateStorageAdapter = {
  <TNative>(adapter: SyncStorageAdapter<TNative>): SyncStorageAdapter<TNative>;
  <TNative>(
    adapter: AsyncStorageAdapter<TNative>,
  ): AsyncStorageAdapter<TNative>;
};

/**
 * Adds idempotent disposal and silences observers after disposal.
 * Subscriptions after disposal never reach the backend.
 * Later reads, writes and key enumeration throw an error naming the adapter.
 * Optional capabilities stay absent when the mapping does not provide them.
 *
 * @example
 * ```ts
 * export const memory = () =>
 *   createStorageAdapter({
 *     mode: "sync",
 *     name: "memory",
 *     native: store,
 *     get: (key) => store.get(key),
 *     set: (key, value) => store.set(key, value),
 *     remove: (key) => store.delete(key),
 *     keys: () => [...store.keys()],
 *     available: () => true,
 *     dispose: () => store.clear(),
 *   });
 * ```
 */
export const createStorageAdapter: CreateStorageAdapter = <
  TMode extends "sync" | "async",
  TNative,
  TRead,
  TWrite,
  TKeys,
>(
  adapter: StorageAdapterShape<TMode, TNative, TRead, TWrite, TKeys>,
): StorageAdapterShape<TMode, TNative, TRead, TWrite, TKeys> => {
  let disposed = false;

  const assertLive = (action: string) => {
    if (!disposed) {
      return;
    }

    throw new Error(
      `Cannot ${action} through the disposed ${adapter.name} storage adapter.`,
    );
  };

  const keys = adapter.keys;
  const observe = adapter.observe;
  const keyspace = adapter.keyspace;

  return {
    mode: adapter.mode,
    name: adapter.name,
    // Keep lazy platform resolution lazy.
    get native() {
      return adapter.native;
    },
    get: (key) => {
      assertLive(`read "${key}"`);

      return adapter.get(key);
    },
    set: (key, value) => {
      assertLive(`write "${key}"`);

      return adapter.set(key, value);
    },
    remove: (key) => {
      assertLive(`remove "${key}"`);

      return adapter.remove(key);
    },
    available: () => adapter.available(),
    ...(keyspace === undefined ? {} : { keyspace }),
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      adapter.dispose();
    },
    ...(typeof keys !== "function"
      ? {}
      : {
          keys: () => {
            assertLive("list keys");

            return keys.call(adapter);
          },
        }),
    ...(typeof observe !== "function"
      ? {}
      : {
          observe: (listener: (change: StorageChange) => void) => {
            if (disposed) {
              return () => {};
            }

            return observe.call(adapter, (change) => {
              if (disposed) {
                return;
              }

              listener(change);
            });
          },
        }),
  };
};
