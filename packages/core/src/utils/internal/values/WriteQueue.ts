import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { deferred } from "src/utils/common/deferred";
import type { Backend } from "src/utils/internal/adapter/Backend";

export type WriteRequest = { kind: "set"; raw: unknown } | { kind: "remove" };
type WriteOperation = Parameters<WriteQueue["accept"]>[0] & {
  generation: number;
};
type Barrier = {
  target: number;
  settlement: ReturnType<typeof deferred<void>>;
};
type State =
  | { state: "PAUSED" | "READY"; backend: Pick<Backend, "set" | "remove"> }
  | { state: "CLOSED"; error: unknown }
  | { state: "DISPOSED"; reason: string };

/** Serializes writes and settles durability barriers, retaining only the latest pending write. */
export class WriteQueue {
  #options;
  #state: State;
  #generation = { accepted: 0, durable: 0 };
  #operations:
    | {
        inflight: WriteOperation | undefined;
        pending: WriteOperation | undefined;
      }
    | undefined;

  #failure: { error: unknown } | null = null;
  #barriers: Barrier[] | undefined;

  constructor(options: {
    key: string;
    backend: Pick<Backend, "set" | "remove">;
    /** Told about every change of the counters, and about each write's outcome, for the inspector. */
    trace?: {
      changed: () => void;
      durable: (generation: number) => void;
      refused: (generation: number, error: unknown) => void;
    };
  }) {
    const { backend, ...queue } = options;
    this.#options = queue;
    this.#state = { state: "PAUSED", backend };
  }

  inspect() {
    return {
      accepted: this.#generation.accepted,
      durable: this.#generation.durable,
      inflight: this.#operations?.inflight !== undefined,
    };
  }

  get dirty() {
    return this.#generation.accepted > this.#generation.durable;
  }

  start() {
    if (this.#state.state !== "PAUSED") {
      return;
    }

    this.#state = { state: "READY", backend: this.#state.backend };
    this.#drain();
  }

  accept(options: {
    request: WriteRequest;
    observer: { error: (cause: unknown) => void };
  }) {
    const operation = { ...options, generation: ++this.#generation.accepted };
    this.#failure = null;
    if (this.#state.state === "DISPOSED") {
      this.#refuse(operation, new Error(this.#state.reason));
      return;
    }
    if (this.#state.state === "CLOSED") {
      this.#refuse(operation, this.#state.error);
      return;
    }

    if (this.#operations === undefined) {
      this.#operations = { inflight: undefined, pending: undefined };
    }
    this.#operations.pending = operation;
    this.#drain();
    this.#options.trace?.changed();
  }

  acknowledge() {
    if (this.#state.state === "CLOSED" || this.#state.state === "DISPOSED") {
      return;
    }

    this.#failure = null;
    this.#settle(++this.#generation.accepted);
    this.#options.trace?.changed();
  }

  busy() {
    const operations = this.#operations;
    if (operations === undefined) {
      return false;
    }
    return (
      operations.inflight !== undefined || operations.pending !== undefined
    );
  }

  flush(): Promise<void> {
    if (!this.dirty) {
      return Promise.resolve();
    }

    if (this.#state.state === "DISPOSED") {
      return Promise.reject(new Error(this.#state.reason));
    }

    if (this.#failure !== null) {
      return Promise.reject(this.#failure.error);
    }

    const barrier = {
      target: this.#generation.accepted,
      settlement: deferred(),
    };

    if (this.#barriers === undefined) {
      this.#barriers = [];
    }
    this.#barriers.push(barrier);
    return barrier.settlement.promise;
  }

  close(error: unknown) {
    if (this.#state.state === "CLOSED" || this.#state.state === "DISPOSED") {
      return;
    }

    this.#state = { state: "CLOSED", error };
    const latest = this.#operations?.pending ?? this.#operations?.inflight;
    this.#operations = undefined;
    this.#failure = { error };
    this.#release(this.#generation.accepted, (barrier) =>
      barrier.settlement.reject(error),
    );
    latest?.observer.error(error);
  }

  dispose(reason: string) {
    if (this.#state.state === "DISPOSED") {
      return;
    }
    this.close(this.dirty ? new Error(reason) : undefined);
    // Keep the reason, not an Error whose stack can retain the former owner.
    this.#state = { state: "DISPOSED", reason };
    this.#failure = null;
  }

  #drain() {
    if (this.#state.state !== "READY") {
      return;
    }

    const operations = this.#operations;
    if (operations === undefined) {
      return;
    }

    if (operations.inflight !== undefined) {
      return;
    }

    if (operations.pending === undefined) {
      this.#operations = undefined;
      return;
    }

    const backend = this.#state.backend;
    const operation = operations.pending;
    operations.pending = undefined;
    operations.inflight = operation;
    const observer = {
      done: () => {
        if (this.#operations?.inflight !== operation) {
          return;
        }

        this.#operations.inflight = undefined;
        this.#settle(operation.generation);
        this.#options.trace?.durable(operation.generation);
        this.#drain();
        this.#options.trace?.changed();
      },
      error: (error: unknown) => {
        if (this.#operations?.inflight !== operation) {
          return;
        }

        this.#operations.inflight = undefined;
        this.#refuse(operation, error);
        this.#drain();
        this.#options.trace?.changed();
      },
    };

    const { request } = operation;
    if (request.kind === "set") {
      backend.set(this.#options.key, request.raw, observer);
      return;
    }

    if (request.kind === "remove") {
      backend.remove(this.#options.key, observer);
      return;
    }

    assertUnreachable(request);
  }

  #settle(generation: number) {
    this.#generation.durable = Math.max(this.#generation.durable, generation);
    this.#release(this.#generation.durable, (barrier) =>
      barrier.settlement.resolve(),
    );
  }

  #refuse(operation: WriteOperation, error: unknown) {
    this.#release(operation.generation, (barrier) =>
      barrier.settlement.reject(error),
    );
    if (this.#generation.accepted !== operation.generation) {
      return;
    }

    this.#failure = { error };
    this.#options.trace?.refused(operation.generation, error);
    operation.observer.error(error);
  }

  #release(bound: number, settle: (barrier: Barrier) => void) {
    const barriers = this.#barriers;
    if (barriers === undefined) {
      return;
    }
    const waiting: Barrier[] = [];
    for (const barrier of barriers) {
      if (barrier.target > bound) {
        waiting.push(barrier);
        continue;
      }

      settle(barrier);
    }

    this.#barriers = waiting.length === 0 ? undefined : waiting;
  }
}
