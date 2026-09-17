import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { AsyncTextStorageMapping } from "src/types/AsyncTextStorageMapping";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import type { SyncTextStorageMapping } from "src/types/SyncTextStorageMapping";
import type { TextFormat } from "src/types/TextFormat";
import type { TextStorageChange } from "src/types/TextStorageChange";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { createStorageAdapter } from "src/generators/createStorageAdapter";

const decode = (
  format: TextFormat,
  text: string | null | undefined,
): unknown => {
  if (typeof text !== "string") {
    return undefined;
  }

  return format.parse(text);
};

// Invalid external data must not replace the current snapshot.
const decodeChange = (
  format: TextFormat,
  change: TextStorageChange,
): StorageChange | null => {
  if (change.key === null) {
    return change;
  }

  try {
    return { key: change.key, value: decode(format, change.text) };
  } catch {
    return null;
  }
};

const decodeReports =
  (
    format: TextFormat,
    observe: (listener: (change: TextStorageChange) => void) => () => void,
  ) =>
  (listener: (change: StorageChange) => void) =>
    observe((change) => {
      const decoded = decodeChange(format, change);

      if (decoded === null) {
        return;
      }

      listener(decoded);
    });

const syncTextStorageAdapter = <TNative>(
  mapping: SyncTextStorageMapping<TNative>,
): SyncStorageAdapter<TNative> => {
  const format = mapping.format ?? JSON;
  const keys = mapping.keys;
  const observe = mapping.observe;
  const keyspace = mapping.keyspace;

  return createStorageAdapter({
    mode: "sync",
    name: mapping.name,
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
    available: () => mapping.available(),
    ...(keyspace === undefined ? {} : { keyspace }),
    dispose: () => mapping.dispose(),
    ...(typeof keys !== "function" ? {} : { keys: () => keys() }),
    ...(typeof observe !== "function"
      ? {}
      : { observe: decodeReports(format, observe) }),
  });
};

const asyncTextStorageAdapter = <TNative>(
  mapping: AsyncTextStorageMapping<TNative>,
): AsyncStorageAdapter<TNative> => {
  const format = mapping.format ?? JSON;
  const keys = mapping.keys;
  const observe = mapping.observe;
  const keyspace = mapping.keyspace;

  return createStorageAdapter({
    mode: "async",
    name: mapping.name,
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
    available: () => mapping.available(),
    ...(keyspace === undefined ? {} : { keyspace }),
    dispose: () => mapping.dispose(),
    ...(typeof keys !== "function" ? {} : { keys: () => keys() }),
    ...(typeof observe !== "function"
      ? {}
      : { observe: decodeReports(format, observe) }),
  });
};

/**
 * Builds a storage adapter over a backend that holds strings: `localStorage`,
 * MMKV, AsyncStorage, Redis, a cookie. The mapping describes `read`, `write`
 * and `remove` over text, and the adapter owns the JSON on both sides:
 * `JSON.stringify` on every write, `JSON.parse` on every read, `undefined`
 * written as a removal, and a text that will not parse thrown from `get` so
 * the core reports it as a failed hydration. An `observe` that reports text
 * is decoded the same way, and a report that will not decode is dropped.
 * `format` swaps JSON for `superjson`, `devalue` or anything with the same
 * two methods.
 *
 * Everything `createStorageAdapter` guarantees holds here too: disposal runs
 * once, observers fall silent after it, and later operations throw an error
 * naming the adapter.
 *
 * @example
 * ```ts
 * export const mmkv = ({ storage }: { storage: MMKV }) =>
 *   createTextStorageAdapter({
 *     mode: "sync",
 *     name: "mmkv",
 *     native: storage,
 *     read: (key) => storage.getString(key),
 *     write: (key, text) => storage.set(key, text),
 *     remove: (key) => storage.delete(key),
 *     keys: () => storage.getAllKeys(),
 *     available: () => true,
 *     dispose: () => {},
 *   });
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
  if (mapping.mode === "sync") {
    return syncTextStorageAdapter(mapping);
  }

  if (mapping.mode === "async") {
    return asyncTextStorageAdapter(mapping);
  }

  return assertUnreachable(mapping);
}
