import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { AsyncTextStorageMapping } from "src/types/AsyncTextStorageMapping";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import type { SyncTextStorageMapping } from "src/types/SyncTextStorageMapping";
import type { TextFormat } from "src/types/TextFormat";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { createStorageAdapter } from "src/generators/createStorageAdapter";

/**
 * Builds an adapter over string storage using JSON or a custom `format`.
 * A format returning undefined removes the key. Malformed reads fail hydration;
 * malformed external changes report their error. Includes idempotent disposal.
 *
 * @example
 * ```ts
 * const adapter = createTextStorageAdapter({
 *   mode: "sync",
 *   name: "settings",
 *   native: storage,
 *   read: (key) => storage.getItem(key),
 *   write: (key, text) => storage.setItem(key, text),
 *   remove: (key) => storage.removeItem(key),
 *   available: () => true,
 *   dispose: () => {},
 * });
 * ```
 */
// Overloads preserve the mapping's mode: unknown cannot distinguish promised reads.
export function createTextStorageAdapter<TNative>(
  mapping: SyncTextStorageMapping<TNative>,
): SyncStorageAdapter<TNative>;
export function createTextStorageAdapter<TNative>(
  mapping: AsyncTextStorageMapping<TNative>,
): AsyncStorageAdapter<TNative>;
export function createTextStorageAdapter<TNative>(
  mapping: SyncTextStorageMapping<TNative> | AsyncTextStorageMapping<TNative>,
): StorageAdapter<TNative> {
  const format = mapping.format ?? JSON;
  const observe = mapping.observe;
  const keyspace = mapping.keyspace;
  const shared = {
    name: mapping.name,
    available: () => mapping.available(),
    dispose: () => mapping.dispose(),
    ...(keyspace === undefined ? {} : { keyspace }),
    ...(typeof observe !== "function"
      ? {}
      : {
          observe: (listener: (change: StorageChange) => void) =>
            observe.call(mapping, (change) => {
              if ("error" in change || change.key === null) {
                listener(change);
                return;
              }

              let value: unknown;
              try {
                value = decode(format, change.text);
              } catch (cause) {
                listener({ key: change.key, error: { cause } });
                return;
              }
              listener({ key: change.key, value });
            }),
        }),
  };

  if (mapping.mode === "sync") {
    const keys = mapping.keys;
    return createStorageAdapter({
      ...shared,
      mode: "sync",
      get native() {
        return mapping.native;
      },
      get: (key) => decode(format, mapping.read(key)),
      set: (key, value) => {
        const text = format.stringify(value);
        if (text === undefined) {
          mapping.remove(key);
          return;
        }
        mapping.write(key, text);
      },
      remove: (key) => mapping.remove(key),
      ...(typeof keys !== "function" ? {} : { keys: () => keys.call(mapping) }),
    });
  }

  if (mapping.mode === "async") {
    const keys = mapping.keys;
    return createStorageAdapter({
      ...shared,
      mode: "async",
      get native() {
        return mapping.native;
      },
      get: async (key) => decode(format, await mapping.read(key)),
      set: async (key, value) => {
        const text = format.stringify(value);
        if (text === undefined) {
          await mapping.remove(key);
          return;
        }
        await mapping.write(key, text);
      },
      remove: (key) => mapping.remove(key),
      ...(typeof keys !== "function" ? {} : { keys: () => keys.call(mapping) }),
    });
  }

  return assertUnreachable(mapping);
}

const decode = (
  format: TextFormat,
  text: string | null | undefined,
): unknown => {
  if (typeof text !== "string") {
    return undefined;
  }
  return format.parse(text);
};
