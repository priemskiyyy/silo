import type { SiloDiagnosticEvent } from "src/types/SiloDiagnosticEvent";
import type { SiloDiagnostics } from "src/types/SiloDiagnostics";
import type { SiloSnapshot } from "src/types/SiloSnapshot";
import { isolate } from "src/utils/common/errors";

type State =
  | {
      state: "ACTIVE";
      read: () => SiloSnapshot;
      snapshot: SiloSnapshot | undefined;
    }
  | { state: "DISPOSED"; snapshot: SiloSnapshot };

/** Lazy snapshots and microtask-batched notifications, closed after the final disposal event. */
export class Diagnostics {
  #state: State;
  #listeners = new Set<() => void>();
  #eventListeners = new Set<(event: SiloDiagnosticEvent) => void>();
  #scheduled = false;

  constructor(read: () => SiloSnapshot) {
    this.#state = { state: "ACTIVE", read, snapshot: undefined };
  }

  get recording() {
    return this.#state.state === "ACTIVE" && this.#eventListeners.size > 0;
  }

  api: SiloDiagnostics = {
    get: () => {
      const state = this.#state;
      if (state.state === "DISPOSED") {
        return state.snapshot;
      }
      if (state.snapshot === undefined) {
        state.snapshot = state.read();
      }
      return state.snapshot;
    },
    subscribe: (listener) => {
      if (this.#state.state === "DISPOSED") {
        return () => {};
      }
      const notify = () => listener();
      this.#listeners.add(notify);
      return () => {
        this.#listeners.delete(notify);
      };
    },
    events: {
      subscribe: (listener) => {
        if (this.#state.state === "DISPOSED") {
          return () => {};
        }
        const handle = (event: SiloDiagnosticEvent) => listener(event);
        this.#eventListeners.add(handle);
        return () => {
          this.#eventListeners.delete(handle);
        };
      },
    },
  };

  changed = () => {
    if (this.#state.state === "DISPOSED") {
      return;
    }
    this.#state.snapshot = undefined;
    if (this.#listeners.size === 0 || this.#scheduled) {
      return;
    }
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      this.#notify();
    });
  };

  record = (event: Omit<SiloDiagnosticEvent, "timestamp">) => {
    if (!this.recording) {
      return;
    }
    this.#emit(event);
  };

  dispose = () => {
    if (this.#state.state === "DISPOSED") {
      return;
    }
    this.#state = { state: "DISPOSED", snapshot: this.#state.read() };
    if (this.#eventListeners.size > 0) {
      this.#emit({
        source: "store",
        type: "store disposed",
        storage: null,
        key: null,
        context: null,
      });
    }
    this.#notify();
    this.#listeners.clear();
    this.#eventListeners.clear();
  };

  #notify() {
    for (const listener of [...this.#listeners]) {
      if (!this.#listeners.has(listener)) {
        continue;
      }
      isolate(listener);
    }
  }

  #emit(event: Omit<SiloDiagnosticEvent, "timestamp">) {
    if (this.#eventListeners.size === 0) {
      return;
    }
    const full: SiloDiagnosticEvent = { ...event, timestamp: Date.now() };
    for (const listener of [...this.#eventListeners]) {
      if (!this.#eventListeners.has(listener)) {
        continue;
      }
      isolate(() => listener(full));
    }
  }
}
