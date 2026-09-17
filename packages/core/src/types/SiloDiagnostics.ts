import type { ObservableValue } from "src/types/ObservableValue";
import type { SiloDiagnosticEvent } from "src/types/SiloDiagnosticEvent";
import type { SiloSnapshot } from "src/types/SiloSnapshot";

/**
 * Read-only view for devtools: the snapshot as an observable, and a stream of
 * events. Observing creates no demand: nothing is read from an adapter, and
 * events are only assembled while someone listens. Disposal sends one final
 * notification, clears listeners, and leaves a stable snapshot with no records.
 *
 * @example
 * ```ts
 * const stop = silo.diagnostics.subscribe(() => render(silo.diagnostics.get()));
 * ```
 */
export type SiloDiagnostics = ObservableValue<SiloSnapshot> & {
  events: {
    subscribe: (listener: (event: SiloDiagnosticEvent) => void) => () => void;
  };
};
