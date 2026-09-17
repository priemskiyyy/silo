import type {
  AsyncStorageAdapter,
  StorageAdapterShape,
  StorageChange,
  SyncStorageAdapter,
} from "@priemskiyyy/silo";
import { readChange } from "src/readChange";
import type { SimulcastAdapterOptions } from "src/types/SimulcastAdapterOptions";

// Overloads preserve the wrapped adapter's mode and native type.
type Simulcast = {
  <TNative>(
    options: SimulcastAdapterOptions<SyncStorageAdapter<TNative>>,
  ): SyncStorageAdapter<TNative>;
  <TNative>(
    options: SimulcastAdapterOptions<AsyncStorageAdapter<TNative>>,
  ): AsyncStorageAdapter<TNative>;
};

const isThenable = (value: unknown): value is PromiseLike<unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "then" in value && typeof value.then === "function";
};

/**
 * Adds channel notifications to an adapter while preserving its mode and native handle.
 * Optional publish runs after successful writes; announcement failures do not fail persistence.
 *
 * @example
 * ```ts
 * const adapter = simulcast({
 *   adapter: http({ url: "https://api.example.com/kv" }),
 *   channel: realtime.channel("silo"),
 * });
 * ```
 */
export const simulcast: Simulcast = <
  TMode extends "sync" | "async",
  TNative,
  TRead,
  TWrite,
  TKeys,
>({
  adapter,
  channel,
  publish,
  available = () => adapter.available(),
}: SimulcastAdapterOptions<
  StorageAdapterShape<TMode, TNative, TRead, TWrite, TKeys>
>): StorageAdapterShape<TMode, TNative, TRead, TWrite, TKeys> => {
  const stops = new Set<() => void>();
  const keys = adapter.keys;
  const observe = adapter.observe;
  let disposed = false;

  const announce = (change: StorageChange) => {
    if (disposed) {
      return;
    }

    if (typeof publish !== "function") {
      return;
    }

    try {
      publish(change)?.catch(() => undefined);
    } catch {
      // An announcement failure does not invalidate the persisted write.
    }
  };

  const announceAfter = <TResult>(
    result: TResult,
    change: StorageChange,
  ): TResult => {
    if (isThenable(result)) {
      result.then(
        () => announce(change),
        () => undefined,
      );
      return result;
    }

    announce(change);
    return result;
  };

  return {
    mode: adapter.mode,
    name: `${adapter.name}+simulcast`,
    get native() {
      return adapter.native;
    },
    get: (key) => adapter.get(key),
    set: (key, value) => announceAfter(adapter.set(key, value), { key, value }),
    remove: (key) =>
      announceAfter(adapter.remove(key), { key, value: undefined }),
    available,
    ...(typeof keys !== "function" ? {} : { keys: () => keys() }),
    ...(adapter.keyspace === undefined ? {} : { keyspace: adapter.keyspace }),
    dispose: () => {
      if (disposed) {
        return;
      }

      disposed = true;
      for (const stop of [...stops]) {
        stop();
      }

      adapter.dispose();
    },
    observe: (listener) => {
      if (disposed) {
        return () => {};
      }

      let live = true;
      const handleChange = (change: StorageChange) => {
        if (!live) {
          return;
        }

        listener(change);
      };
      const unsubscribe = channel.subscribe(({ data }) => {
        const change = readChange(data);

        if (change === null) {
          return;
        }

        handleChange(change);
      });
      let release: (() => void) | undefined;

      try {
        if (typeof observe === "function") {
          release = observe(handleChange);
        }
      } catch (error) {
        live = false;
        unsubscribe();
        throw error;
      }

      const stop = () => {
        if (!live) {
          return;
        }

        live = false;
        stops.delete(stop);
        try {
          unsubscribe();
        } finally {
          release?.();
        }
      };

      stops.add(stop);

      return stop;
    },
  };
};
