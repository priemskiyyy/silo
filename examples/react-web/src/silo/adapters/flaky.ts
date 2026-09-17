import type { AsyncStorageAdapter } from "@priemskiyyy/silo";
import { createStorageAdapter } from "@priemskiyyy/silo";
import type { Faults } from "src/silo/adapters/createFaults";

/**
 * The same adapter, refusing one write when the Lab asks: the core reports the
 * refusal on the value's status and keeps the optimistic snapshot, which is
 * what the Composer's Retry demonstrates.
 */
export const flaky = <TNative>(
  adapter: AsyncStorageAdapter<TNative>,
  faults: Faults,
): AsyncStorageAdapter<TNative> => {
  const keys = adapter.keys;
  const observe = adapter.observe;
  const refuse = () =>
    Promise.reject(
      new Error("The journal refused this write because the Lab asked it to."),
    );

  return createStorageAdapter<TNative>({
    mode: "async",
    name: adapter.name,
    get native() {
      return adapter.native;
    },
    get: (key) => adapter.get(key),
    set: (key, value) => {
      if (faults.take()) {
        return refuse();
      }

      return adapter.set(key, value);
    },
    remove: (key) => {
      if (faults.take()) {
        return refuse();
      }

      return adapter.remove(key);
    },
    available: () => adapter.available(),
    dispose: () => adapter.dispose(),
    ...(typeof keys !== "function" ? {} : { keys: () => keys() }),
    ...(typeof observe !== "function" ? {} : { observe }),
  });
};
