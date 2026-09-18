import type { StorageAdapter } from "src/types/StorageAdapter";
import { assertUnreachable } from "src/utils/common/assertUnreachable";

type WriteObserver = {
  done: () => void;
  error: (error: unknown) => void;
};

/** Executes adapter operations inline for sync adapters and on settlement for async adapters. */
export class Backend {
  adapter;
  execution;

  constructor(options: {
    adapter: StorageAdapter;
    execution?: { mode: StorageAdapter["mode"] };
  }) {
    this.adapter = options.adapter;
    this.execution = { mode: options.execution?.mode ?? options.adapter.mode };
  }

  get(
    key: string,
    observer: {
      value: (raw: unknown) => void;
      error: (error: unknown) => void;
    },
  ) {
    this.#execute(() => this.adapter.get(key), observer.value, observer.error);
  }

  set(key: string, raw: unknown, observer: WriteObserver) {
    this.#execute(
      () => this.adapter.set(key, raw),
      observer.done,
      observer.error,
    );
  }

  remove(key: string, observer: WriteObserver) {
    this.#execute(
      () => this.adapter.remove(key),
      observer.done,
      observer.error,
    );
  }

  #execute(
    call: () => unknown,
    handleResult: (result: unknown) => void,
    handleError: (error: unknown) => void,
  ) {
    let result: unknown;
    try {
      result = call();
    } catch (error) {
      if (this.execution.mode === "async") {
        Promise.reject(error).then(handleResult, handleError);
        return;
      }
      if (this.execution.mode === "sync") {
        handleError(error);
        return;
      }
      return assertUnreachable(this.execution.mode);
    }

    // Observer errors belong to their caller, not to the adapter operation.
    if (this.execution.mode === "sync") {
      handleResult(result);
      return;
    }
    if (this.execution.mode === "async") {
      Promise.resolve(result).then(handleResult, handleError);
      return;
    }
    assertUnreachable(this.execution.mode);
  }
}
