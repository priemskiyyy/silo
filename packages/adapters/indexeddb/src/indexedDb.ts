import { createStorageAdapter } from "@priemskiyyy/silo";
import type { AsyncStorageAdapter, StorageChange } from "@priemskiyyy/silo";
import type { IndexedDbAdapterOptions } from "src/types/IndexedDbAdapterOptions";
import type { IndexedDbHandle } from "src/types/IndexedDbHandle";

const failed = (error: DOMException | null, description: string) =>
  error ?? new Error(description);

const requested = <TValue>(request: IDBRequest<TValue>) =>
  new Promise<TValue>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(failed(request.error, "An IndexedDB request failed."));
  });

// A successful request is not durable until its transaction completes.
const completed = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(failed(transaction.error, "An IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(
        failed(transaction.error, "An IndexedDB transaction was aborted."),
      );
  });

const openDatabase = ({
  name,
  store,
  version,
  onLost,
}: {
  name: string;
  store: string;
  version: number | undefined;
  onLost: () => void;
}) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const factory = globalThis.indexedDB;

    if (!factory) {
      reject(
        new Error(
          `The indexeddb storage adapter cannot open "${name}": this environment has no indexedDB.`,
        ),
      );

      return;
    }

    const open = factory.open(name, version);

    open.onupgradeneeded = () => {
      if (open.result.objectStoreNames.contains(store)) {
        return;
      }

      open.result.createObjectStore(store);
    };

    // A blocked open remains pending until the other connection closes.
    open.onblocked = () =>
      console.warn(
        `The indexeddb storage adapter is waiting to open "${name}": another connection holds it at an older version. Reads and writes stay pending until that connection closes.`,
      );

    open.onsuccess = () => {
      const database = open.result;

      // close() does not fire onclose; version changes must clear the cached handle too.
      database.onversionchange = () => {
        database.close();
        onLost();
      };
      database.onclose = () => onLost();

      resolve(database);
    };

    open.onerror = () =>
      reject(
        failed(open.error, `IndexedDB refused to open the database "${name}".`),
      );
  });


/**
 * Stores structured values in IndexedDB, using one transaction per operation.
 * Cross-tab observation covers writes announced by other Silo adapters.
 *
 * @example
 * ```ts
 * const adapter = indexedDb({ name: "acme" });
 * const database = await adapter.native.database();
 * ```
 */
export const indexedDb = ({
  name: databaseName = "silo",
  store = "values",
  version,
  sharing = "cross-tab",
  available = () => typeof globalThis.indexedDB !== "undefined",
}: IndexedDbAdapterOptions = {}) => {
  let connection: Promise<IDBDatabase> | null = null;
  let channel: BroadcastChannel | null = null;
  let disposed = false;

  const connect = () => {
    if (disposed) {
      return Promise.reject(
        new Error(
          `The indexeddb storage adapter for "${databaseName}" was disposed.`,
        ),
      );
    }

    if (connection) {
      return connection;
    }

    const opening: Promise<IDBDatabase> = openDatabase({
      name: databaseName,
      store,
      version,
      onLost: () => {
        if (connection === opening) {
          connection = null;
        }
      },
    }).catch((error: unknown) => {
      if (connection === opening) {
        connection = null;
      }

      throw error;
    });

    connection = opening;

    return opening;
  };

  const openChannel = () => {
    if (disposed) {
      return null;
    }

    if (sharing === "single-tab") {
      return null;
    }

    const Channel = globalThis.BroadcastChannel;

    if (typeof Channel !== "function") {
      return null;
    }

    if (channel === null) {
      channel = new Channel(`silo:indexeddb:${databaseName}:${store}`);
    }

    return channel;
  };

  // Await the connection before opening a transaction; unrelated awaits can auto-commit it.
  const inspect = async <TResult>(
    request: (target: IDBObjectStore) => IDBRequest<TResult>,
  ) => {
    const database = await connect();
    const transaction = database.transaction(store, "readonly");

    return await requested(request(transaction.objectStore(store)));
  };

  const mutate = async (
    apply: (target: IDBObjectStore) => void,
    change: StorageChange,
  ) => {
    const database = await connect();
    const transaction = database.transaction(store, "readwrite");
    const durable = completed(transaction);

    apply(transaction.objectStore(store));

    await durable;
    openChannel()?.postMessage(change);
  };

  const native: IndexedDbHandle = {
    name: databaseName,
    version,
    database: () => connect(),
  };

  return createStorageAdapter({
    mode: "async",
    name: "indexeddb",
    native,
    get: (key: string) => inspect<unknown>((target) => target.get(key)),
    set: (key: string, value: unknown) =>
      mutate((target) => target.put(value, key), { key, value }),
    remove: (key: string) =>
      mutate((target) => target.delete(key), { key, value: undefined }),
    keys: async () =>
      (await inspect((target) => target.getAllKeys())).flatMap((key) =>
        typeof key === "string" ? [key] : [],
      ),
    available,
    dispose: () => {
      disposed = true;
      channel?.close();
      channel = null;

      const opening = connection;
      connection = null;
      // Close a pending connection once it opens so it cannot block later upgrades.
      opening?.then((database) => database.close()).catch(() => undefined);
    },
    ...(sharing === "cross-tab"
      ? {
          observe: (listener: (change: StorageChange) => void) => {
            const target = openChannel();

            if (!target) {
              return () => {};
            }

            const handleMessage = (event: MessageEvent<StorageChange>) =>
              listener(event.data);

            target.addEventListener("message", handleMessage);

            return () => target.removeEventListener("message", handleMessage);
          },
        }
      : {}),
  } satisfies AsyncStorageAdapter<IndexedDbHandle>);
};
