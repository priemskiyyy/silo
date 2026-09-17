import type { ObservableValue } from "src/types/ObservableValue";
import type { ValueStatus } from "src/types/ValueStatus";

/**
 * One stored value, memoized per key per scope: an observable of its snapshot,
 * plus the writes and the barriers over it.
 *
 * `get` is synchronous on every adapter and returns the STORED reference:
 * decoding runs once per inbound value, so the identity is stable between
 * changes and `useSyncExternalStore` consumers do not loop. Stored values are
 * therefore immutable; mutating what you passed to `set` corrupts the snapshot
 * with no notification. Acquiring the handle with `silo.value(key)` starts
 * hydration; reading or subscribing to an existing handle does not reload it.
 * Adapter write failures appear on status and flush; encoding errors throw.
 *
 * @example
 * ```ts
 * const theme = silo.value("theme");
 * theme.subscribe(() => render(theme.get()));
 * theme.set("dark");
 * ```
 */
export type SiloValue<TValue> = ObservableValue<TValue> & {
  set: (value: TValue) => void;
  remove: () => void;
  status: ObservableValue<ValueStatus>;
  hydrated: () => Promise<void>;
  flush: () => Promise<void>;
};
