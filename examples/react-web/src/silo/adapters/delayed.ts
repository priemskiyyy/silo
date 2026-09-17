import type { AsyncStorageAdapter } from "@priemskiyyy/silo";
import { createStorageAdapter } from "@priemskiyyy/silo";
import { sleep } from "src/utils/sleep";

/**
 * The same adapter, every operation late by `latency` milliseconds, so the
 * hydrating and in-flight states a fast local backend hides become visible.
 * Zero latency hands the adapter back untouched.
 */
export const delayed = <TNative>(
  adapter: AsyncStorageAdapter<TNative>,
  latency: number,
): AsyncStorageAdapter<TNative> => {
  if (latency === 0) {
    return adapter;
  }

  const keys = adapter.keys;
  const observe = adapter.observe;

  return createStorageAdapter<TNative>({
    mode: "async",
    name: adapter.name,
    get native() {
      return adapter.native;
    },
    get: async (key) => {
      await sleep(latency);
      return adapter.get(key);
    },
    set: async (key, value) => {
      await sleep(latency);
      await adapter.set(key, value);
    },
    remove: async (key) => {
      await sleep(latency);
      await adapter.remove(key);
    },
    available: () => adapter.available(),
    dispose: () => adapter.dispose(),
    ...(typeof keys !== "function"
      ? {}
      : {
          keys: async () => {
            await sleep(latency);
            return keys();
          },
        }),
    ...(typeof observe !== "function" ? {} : { observe }),
  });
};
