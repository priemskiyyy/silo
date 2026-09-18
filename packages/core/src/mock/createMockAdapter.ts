import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { deferred } from "src/utils/common/deferred";

export type MockCall = {
  operation: "get" | "set" | "remove";
  /** The physical key, exactly as the core composed it. */
  key: string;
  /** What `set` received, undecoded. `undefined` for `get` and `remove`. */
  value: unknown;
  /** Open until the test settles it. Only an async mock holds a call open. */
  pending: boolean;
  /** Applies the operation to the store and settles it. Throws if already settled. */
  settle: () => void;
  /** Settles the operation as a failure, leaving the store untouched. */
  fail: (error: unknown) => void;
};

/**
 * The mock's native handle: the backing store plus the controls a test drives it
 * with. Identity stable for the adapter's life, so a harness that only holds the
 * adapter can still reach them.
 */
export type MockNative = {
  store: Map<string, unknown>;
  /** Every `get`, `set` and `remove` the adapter received, in order. */
  calls: MockCall[];
  /** Reports a change to every observer, without touching the store. */
  emit: (change: StorageChange) => void;
  disposeCount: () => number;
};

export type MockControls<TAdapter> = MockNative & {
  adapter: TAdapter;
};

export type MockAdapterOptions = {
  mode?: "sync" | "async";
  /** Runs inside every operation once the call is recorded. Throw to fail that one operation. */
  onCall?: (call: MockCall) => void;
  /** Async only: every operation stays open until the test settles its recorded call, in any order. */
  hold?: boolean;
  /** `false` drops `observe` from the adapter, for the core's capability guard. */
  observe?: boolean;
  /** `false` drops `keys` from the adapter, for the migration store's guard. */
  keys?: boolean;
  /** What the availability probe answers; `true` unless told otherwise. */
  available?: boolean;
  /** Keeps `emit` delivering after `dispose`, which a conforming adapter never does. */
  emitAfterDispose?: boolean;
};

/**
 * Deterministic, deliberately badly behaved storage adapter for core tests.
 *
 * It records every call in order and lets a test hold an operation open, settle
 * or fail it later in any order, and emit an external change of its own: a
 * self-echo, a duplicate, a stale value, or one arriving after `dispose`.
 * `emit` never writes to the store, so the reported change and the stored value
 * are controlled separately. `keys` answers from the store directly and is
 * neither recorded nor held.
 *
 * @example
 * ```ts
 * const mock = createMockAdapter({ mode: "async", hold: true });
 * const silo = new Silo({ storages: { default: { adapters: [mock.adapter], schema: Schema } } });
 * mock.calls.at(-1)?.settle();
 * mock.emit({ key: "silo:theme", value: "dark" });
 * ```
 */
// Overloads, the same carve-out `value` takes: only a pair resolves the
// adapter's mode from the options, and a single signature would hand every test
// the `StorageAdapter` union, which is assignable to neither contract.
export function createMockAdapter(
  options: MockAdapterOptions & { mode: "async" },
): MockControls<AsyncStorageAdapter<MockNative>>;
export function createMockAdapter(
  options?: MockAdapterOptions & { mode?: "sync" },
): MockControls<SyncStorageAdapter<MockNative>>;
export function createMockAdapter(
  options: MockAdapterOptions = {},
):
  | MockControls<AsyncStorageAdapter<MockNative>>
  | MockControls<SyncStorageAdapter<MockNative>> {
  const store = new Map<string, unknown>();
  const calls: MockCall[] = [];
  const listeners = new Set<(change: StorageChange) => void>();
  let disposals = 0;

  const apply = (
    operation: MockCall["operation"],
    key: string,
    value: unknown,
  ): unknown => {
    if (operation === "get") {
      return store.get(key);
    }

    if (operation === "set") {
      store.set(key, value);

      return undefined;
    }

    if (operation === "remove") {
      store.delete(key);

      return undefined;
    }

    return assertUnreachable(operation);
  };

  const claim = (call: MockCall) => {
    if (!call.pending) {
      throw new Error(
        `The mock ${call.operation} of "${call.key}" already settled and cannot be settled again.`,
      );
    }

    call.pending = false;
  };

  const record = (
    operation: MockCall["operation"],
    key: string,
    value: unknown,
    settlement:
      | { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
      | undefined,
  ): MockCall => {
    const call: MockCall = {
      operation,
      key,
      value,
      pending: settlement !== undefined,
      settle: () => {
        claim(call);
        // The store is touched at settlement, not at call time, so a failed
        // write leaves it exactly as it was.
        settlement?.resolve(apply(operation, key, value));
      },
      fail: (error) => {
        claim(call);
        settlement?.reject(error);
      },
    };
    calls.push(call);

    if (typeof options.onCall === "function") {
      options.onCall(call);
    }

    return call;
  };

  const assertLive = (action: string) => {
    if (disposals === 0) {
      return;
    }

    throw new Error(
      `Cannot ${action} through the disposed mock storage adapter.`,
    );
  };

  const perform = (
    operation: MockCall["operation"],
    key: string,
    value: unknown,
  ): unknown => {
    assertLive(`${operation} "${key}"`);
    record(operation, key, value, undefined);

    return apply(operation, key, value);
  };

  // The asynchronous mode is the synchronous one behind a promise, or a call
  // held open for the test to settle. Declared async so a disposed adapter and
  // a throwing `onCall` both reach the caller as a rejection: an async
  // contract has no synchronous failure.
  const later = async (
    operation: MockCall["operation"],
    key: string,
    value: unknown,
  ): Promise<unknown> => {
    if (options.hold !== true) {
      return perform(operation, key, value);
    }

    assertLive(`${operation} "${key}"`);
    const settlement = deferred<unknown>();
    record(operation, key, value, settlement);

    return settlement.promise;
  };

  const listKeys = () => {
    assertLive("list keys");

    return [...store.keys()];
  };

  const native: MockNative = {
    store,
    calls,
    emit: (change) => {
      if (disposals > 0 && options.emitAfterDispose !== true) {
        return;
      }

      for (const listener of [...listeners]) {
        listener(change);
      }
    },
    disposeCount: () => disposals,
  };

  // Absent stays absent: `observe: undefined` is not an optional member under
  // exactOptionalPropertyTypes, so an optional member is spread in only when
  // the options ask for it.
  const shared = {
    name: "mock",
    native,
    dispose: () => {
      disposals += 1;
    },
    available: () => options.available !== false,
    ...(options.observe === false
      ? {}
      : {
          observe: (listener: (change: StorageChange) => void) => {
            listeners.add(listener);

            return () => {
              listeners.delete(listener);
            };
          },
        }),
  };

  if (options.mode === "async") {
    const adapter: AsyncStorageAdapter<MockNative> = {
      ...shared,
      ...(options.keys === false ? {} : { keys: async () => listKeys() }),
      mode: "async",
      get: (key) => later("get", key, undefined),
      set: async (key, value) => {
        await later("set", key, value);
      },
      remove: async (key) => {
        await later("remove", key, undefined);
      },
    };

    return { ...native, adapter };
  }

  const adapter: SyncStorageAdapter<MockNative> = {
    ...shared,
    ...(options.keys === false ? {} : { keys: listKeys }),
    mode: "sync",
    get: (key) => perform("get", key, undefined),
    set: (key, value) => {
      perform("set", key, value);
    },
    remove: (key) => {
      perform("remove", key, undefined);
    },
  };

  return { ...native, adapter };
}
