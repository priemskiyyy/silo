import type { SiloSnapshot } from "src/types/SiloSnapshot";
import type { SiloValue } from "src/types/SiloValue";
import type { ValueDefinition } from "src/types/ValueDefinition";
import type { ValueStatus } from "src/types/ValueStatus";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { deferred } from "src/utils/common/deferred";
import { ValueStore } from "src/utils/common/ValueStore";
import {
  HYDRATING_VALUE_STATUS,
  READY_VALUE_STATUS,
} from "src/utils/constants/status";
import type { Backend } from "src/utils/internal/adapter/Backend";
import type { Diagnostics } from "src/utils/internal/Diagnostics";
import type { Migrations } from "src/utils/internal/migrations/Migrations";
import type { ValueCodec } from "src/utils/internal/values/ValueCodec";
import type { WriteRequest } from "src/utils/internal/values/WriteQueue";
import { WriteQueue } from "src/utils/internal/values/WriteQueue";

type Snapshot = { value: unknown; status: ValueStatus };
type ReadReservation = { revision: number; source: "HYDRATION" | "EXTERNAL" };
type Lifecycle =
  | { state: "BLOCKED" }
  | { state: "ACTIVE" }
  | { state: "FAILED"; error: unknown }
  | { state: "DISPOSED"; reason: string };
type Resources = {
  definition: ValueDefinition<unknown>;
  backend: Backend;
  codec: ValueCodec;
  diagnostics: Pick<Diagnostics, "changed" | "record" | "recording">;
};

/** Owns one key's observable state and decides which reads and writes can replace it. */
export class ValueRecord {
  #key;
  #identity;
  #state;
  #resources: Resources | undefined;
  #writes;
  #revision = 0;
  #read: ReadReservation | null = null;
  #hydration: ReturnType<typeof deferred<void>> | undefined;
  #cancelAdmission: ReturnType<Migrations["admit"]>;
  #inspection: SiloSnapshot["records"][number] | undefined;
  #lifecycle: Lifecycle = { state: "BLOCKED" };

  handle: SiloValue<unknown>;

  constructor(options: {
    key: string;
    /** Where the record lives, the way the inspector reports it. */
    identity: { storage: string; path: string; segments: string[] };
    definition: ValueDefinition<unknown>;
    backend: Backend;
    codec: ValueCodec;
    admit: Migrations["admit"];
    diagnostics: Pick<Diagnostics, "changed" | "record" | "recording">;
  }) {
    this.#key = options.key;
    this.#identity = options.identity;
    this.#resources = {
      definition: options.definition,
      backend: options.backend,
      codec: options.codec,
      diagnostics: options.diagnostics,
    };

    this.#state = new ValueStore<Snapshot>({
      value: options.definition.fallback,
      status: HYDRATING_VALUE_STATUS,
    });
    this.#writes = new WriteQueue({
      key: options.key,
      backend: options.backend,
      trace: {
        changed: () => this.#changed(),
        durable: (generation) =>
          this.#trace("write durable", () => ({ generation })),
        refused: (generation, cause) =>
          this.#trace("write refused", () => ({ generation, cause })),
      },
    });
    this.handle = {
      ...this.#state.select((snapshot) => snapshot.value),
      status: this.#state.select((snapshot) => snapshot.status),
      set: this.set,
      remove: this.remove,
      hydrated: () => this.#hydrated(),
      flush: this.flush,
    };

    this.#cancelAdmission = options.admit({
      open: () => {
        this.#cancelAdmission = undefined;
        if (this.#lifecycle.state === "DISPOSED") {
          return;
        }

        this.#lifecycle = { state: "ACTIVE" };
        this.#writes.start();
        if (this.#read !== null) {
          this.#readStored(this.#read);
        }
      },
      error: (cause) => {
        this.#cancelAdmission = undefined;
        if (this.#lifecycle.state === "DISPOSED") {
          return;
        }

        this.#lifecycle = { state: "FAILED", error: cause };
        this.#writes.close(cause);
        if (this.#read !== null) {
          this.#readStored(this.#read);
        }
      },
    });
  }

  hydrate() {
    if (this.#state.get().status.state !== "hydrating") {
      return;
    }

    if (this.#read !== null) {
      return;
    }

    this.#load("HYDRATION");
  }

  set = (value: unknown) => {
    const resources = this.#resources;
    if (resources === undefined) {
      return;
    }

    if (value === undefined) {
      this.remove();
      return;
    }

    this.#mutate({ kind: "set", raw: resources.codec.encode(value) }, value);
  };

  remove = () => {
    const resources = this.#resources;
    if (resources === undefined) {
      return;
    }

    this.#mutate({ kind: "remove" }, resources.definition.fallback);
  };

  flush = () => this.#writes.flush();

  get dirty() {
    return this.#writes.dirty;
  }

  inspect(): SiloSnapshot["records"][number] {
    if (this.#inspection !== undefined) {
      return this.#inspection;
    }

    const { value, status } = this.#state.get();
    this.#inspection = {
      ...this.#identity,
      physicalKey: this.#key,
      status,
      value,
      writes: this.#writes.inspect(),
    };

    return this.#inspection;
  }

  reload() {
    return this.#load(
      this.#state.get().status.state === "hydrating" ? "HYDRATION" : "EXTERNAL",
    );
  }

  receive(raw: unknown) {
    if (this.#lifecycle.state !== "ACTIVE") {
      return;
    }

    if (this.#writes.busy()) {
      this.#trace("outside dropped", () => ({
        reason: "a local write is in flight",
      }));
      return;
    }

    const resources = this.#resources;
    if (resources === undefined) {
      return;
    }

    const revision = this.#revision;
    const inbound = resources.codec.decode(raw);
    if (!this.#current(revision)) {
      return;
    }

    this.#handleExternal(inbound);
  }

  dispose(reason = "This Silo was disposed") {
    if (this.#lifecycle.state === "DISPOSED") {
      return;
    }

    this.#lifecycle = { state: "DISPOSED", reason };
    this.#cancelAdmission?.();
    this.#cancelAdmission = undefined;
    this.#read = null;
    this.#state.dispose();
    this.#changed();
    this.#resources = undefined;
    this.#writes.dispose(`${reason} before "${this.#key}" finished writing.`);
    if (
      this.#hydration !== undefined &&
      this.#state.get().status.state === "hydrating"
    ) {
      this.#hydration.reject(
        new Error(`${reason} before "${this.#key}" finished hydrating.`),
      );
    }
    this.#hydration = undefined;
  }

  #hydrated(): Promise<void> {
    if (this.#hydration !== undefined) {
      return this.#hydration.promise;
    }

    if (this.#state.get().status.state !== "hydrating") {
      return hydrated;
    }

    if (this.#lifecycle.state === "DISPOSED") {
      return Promise.reject(
        new Error(
          `${this.#lifecycle.reason} before "${this.#key}" finished hydrating.`,
        ),
      );
    }

    this.#hydration = deferred();

    return this.#hydration.promise;
  }

  #changed() {
    this.#inspection = undefined;
    this.#resources?.diagnostics.changed();
  }

  #mutate(request: WriteRequest, value: unknown) {
    if (this.#lifecycle.state === "DISPOSED") {
      return;
    }

    const revision = ++this.#revision;
    this.#read = null;
    let snapshot: Snapshot = { value, status: READY_VALUE_STATUS };
    let accepted = false;
    this.#trace("write accepted", () => ({ kind: request.kind, revision }));
    // Inline failures belong to this commit; later failures publish a new one.
    this.#writes.accept({
      request,
      observer: {
        error: (cause) => {
          snapshot = {
            value,
            status: { state: "error", error: { phase: "write", cause } },
          };

          if (!accepted) {
            return;
          }

          this.#publish(revision, snapshot);
        },
      },
    });
    accepted = true;
    this.#publish(revision, snapshot);
  }

  #load(source: ReadReservation["source"]) {
    if (this.#lifecycle.state === "DISPOSED") {
      return;
    }

    // A read begun during a write can capture stale data even if it finishes later.
    if (this.#writes.busy()) {
      return;
    }

    const read = { revision: this.#revision, source };
    this.#read = read;
    this.#readStored(read);
  }

  #readStored(read: ReadReservation) {
    if (
      this.#lifecycle.state === "BLOCKED" ||
      this.#lifecycle.state === "DISPOSED"
    ) {
      return;
    }

    if (this.#lifecycle.state === "FAILED") {
      this.#handleRead(read, { kind: "invalid", error: this.#lifecycle.error });
      return;
    }

    if (this.#lifecycle.state === "ACTIVE") {
      const resources = this.#resources;
      if (resources === undefined) {
        return;
      }

      resources.backend.get(this.#key, {
        value: (raw) => {
          if (!this.#currentRead(read)) {
            return;
          }

          this.#handleRead(read, resources.codec.decode(raw));
        },
        error: (error) => this.#handleRead(read, { kind: "invalid", error }),
      });
      return;
    }

    assertUnreachable(this.#lifecycle);
  }

  #handleRead(
    read: ReadReservation,
    inbound: ReturnType<ValueCodec["decode"]>,
  ) {
    if (!this.#currentRead(read)) {
      return;
    }

    this.#read = null;
    if (read.source === "HYDRATION") {
      this.#trace("hydrate landed", () => ({
        outcome: inbound.kind,
        ...(inbound.kind === "invalid" ? { cause: inbound.error } : {}),
      }));
      this.#apply(inbound);
      return;
    }

    if (read.source === "EXTERNAL") {
      this.#handleExternal(inbound);
      return;
    }

    assertUnreachable(read.source);
  }

  #handleExternal(inbound: ReturnType<ValueCodec["decode"]>) {
    if (inbound.kind === "invalid") {
      this.#trace("outside dropped", () => ({ cause: inbound.error }));
      return;
    }

    this.#read = null;
    this.#writes.acknowledge();
    this.#trace("outside applied", () => ({ outcome: inbound.kind }));
    this.#apply(inbound);
  }

  #apply(inbound: ReturnType<ValueCodec["decode"]>) {
    const resources = this.#resources;
    if (resources === undefined) {
      return;
    }

    if (inbound.kind === "expired") {
      this.remove();
      return;
    }

    const revision = ++this.#revision;
    if (inbound.kind === "invalid") {
      this.#publish(revision, {
        value: resources.definition.fallback,
        status: {
          state: "error",
          error: { phase: "hydrate", cause: inbound.error },
        },
      });
      return;
    }

    if (inbound.kind === "absent") {
      this.#publish(revision, {
        value: resources.definition.fallback,
        status: READY_VALUE_STATUS,
      });
      return;
    }

    if (inbound.kind === "value") {
      this.#publish(revision, {
        value: inbound.value,
        status: READY_VALUE_STATUS,
      });
      return;
    }

    assertUnreachable(inbound);
  }

  #publish(revision: number, snapshot: Snapshot) {
    if (!this.#current(revision)) {
      return;
    }

    this.#hydration?.resolve();
    this.#changed();
    this.#state.set(snapshot);
  }

  #trace(type: string, context: () => unknown) {
    const diagnostics = this.#resources?.diagnostics;
    if (!diagnostics?.recording) {
      return;
    }
    diagnostics.record({
      source: "value",
      type,
      storage: this.#identity.storage,
      key: this.#key,
      context: context(),
    });
  }

  #current(revision: number) {
    return this.#lifecycle.state !== "DISPOSED" && this.#revision === revision;
  }

  #currentRead(read: ReadReservation) {
    return this.#read === read && this.#current(read.revision);
  }
}

const hydrated = Promise.resolve();
