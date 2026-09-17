import type { ObservableValue } from "src/types/ObservableValue";
import { isolate } from "src/utils/common/errors";

export class ValueStore<TValue> implements ObservableValue<TValue> {
  #snapshot;
  #listeners: Set<{ notify: () => void }> | undefined;
  #disposed = false;

  constructor(initialValue: TValue) {
    this.#snapshot = { value: initialValue };
  }

  get = () => this.#snapshot.value;

  set = (nextValue: TValue) => {
    if (this.#disposed || Object.is(nextValue, this.#snapshot.value)) {
      return;
    }

    const snapshot = { value: nextValue };
    this.#snapshot = snapshot;
    const listeners = this.#listeners;
    if (listeners === undefined) {
      return;
    }

    for (const listener of [...listeners]) {
      // A nested update has already notified listeners of the latest snapshot.
      if (snapshot !== this.#snapshot) {
        return;
      }

      if (!listeners.has(listener)) {
        continue;
      }

      isolate(listener.notify);
    }
  };

  subscribe = (notify: () => void) => {
    if (this.#disposed) {
      return () => {};
    }
    const listener = { notify };
    if (this.#listeners === undefined) {
      this.#listeners = new Set();
    }
    this.#listeners.add(listener);

    return () => {
      const listeners = this.#listeners;
      if (listeners === undefined) {
        return;
      }
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.#listeners = undefined;
      }
    };
  };

  select = <TSelected>(
    select: (value: TValue) => TSelected,
  ): ObservableValue<TSelected> => {
    const get = () => select(this.get());
    return {
      get,
      subscribe: (notify) => {
        let previous = get();
        return this.subscribe(() => {
          const next = get();
          if (Object.is(previous, next)) {
            return;
          }
          previous = next;
          return notify();
        });
      },
    };
  };

  dispose = () => {
    this.#disposed = true;
    this.#listeners?.clear();
    this.#listeners = undefined;
  };
}
