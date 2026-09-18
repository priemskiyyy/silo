import type { AsyncMigration } from "src/types/AsyncMigration";
import type { ObservableValue } from "src/types/ObservableValue";
import type { SiloStatus } from "src/types/SiloStatus";
import type { SiloSnapshot } from "src/types/SiloSnapshot";
import type { SyncMigration } from "src/types/SyncMigration";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { deferred } from "src/utils/common/deferred";
import { isolate } from "src/utils/common/errors";
import { ValueStore } from "src/utils/common/ValueStore";
import {
  MIGRATING_SILO_STATUS,
  READY_SILO_STATUS,
} from "src/utils/constants/status";
import type { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import type { createKeyspaces } from "src/utils/internal/Keyspace";
import type { Diagnostics } from "src/utils/internal/Diagnostics";
import { MigrationStore } from "src/utils/internal/migrations/MigrationStore";

/** Runs migrations and gates reads and writes on their outcome. */
export class Migrations {
  #options;
  #settlement = deferred();
  #waiting = new Set<Parameters<Migrations["admit"]>[0]>();
  #lifecycle: "IDLE" | "STARTED" | "DISPOSED" = "IDLE";
  #status = new ValueStore<SiloStatus>(MIGRATING_SILO_STATUS);
  #version: SiloSnapshot["version"] = {
    declared: 0,
    stored: null,
  };

  status: ObservableValue<SiloStatus> = {
    get: this.#status.get,
    subscribe: this.#status.subscribe,
  };

  ready = this.#settlement.promise;

  constructor(options: {
    backends: AcquiredStorages["backends"];
    keyspaces: ReturnType<typeof createKeyspaces>;
    diagnostics: Pick<Diagnostics, "changed" | "record" | "recording">;
  }) {
    this.#options = options;
    this.ready.then(
      () => this.#admitWaiting((admission) => admission.open()),
      (cause: unknown) =>
        this.#admitWaiting((admission) => admission.error(cause)),
    );
  }

  /** The highest declared step, and the stored version once the chain has read it. */
  inspectVersion = () => ({ ...this.#version });

  start(
    migrations:
      | Record<number, SyncMigration>
      | Record<number, AsyncMigration>
      | undefined,
  ) {
    if (this.#lifecycle !== "IDLE") {
      return;
    }
    this.#lifecycle = "STARTED";
    const { backends } = this.#options;
    if (migrations === undefined || Object.keys(migrations).length === 0) {
      this.#handleDone();
      return;
    }
    if (usesSynchronousMigrations(migrations, backends)) {
      const steps = declaredSteps(migrations);
      this.#version.declared = steps.at(-1)?.version ?? 0;
      try {
        this.#runSync(steps);
        this.#handleDone();
      } catch (error) {
        this.#handleError(error);
      }
      return;
    }
    const steps = declaredSteps(migrations);
    this.#version.declared = steps.at(-1)?.version ?? 0;
    const { adapter } = backends.default;
    let version: number | undefined;

    // A current synchronous default storage can open the gate in this frame.
    if (adapter.mode === "sync") {
      let raw: unknown;
      try {
        raw = adapter.get(this.#options.keyspaces.default.version);
      } catch (error) {
        this.#handleError(error);
        return;
      }
      version = typeof raw === "number" ? raw : 0;
      this.#storedVersion(version);
      if (this.#version.declared <= version) {
        this.#handleDone();
        return;
      }
    }
    this.#runAsync(steps, version).then(this.#handleDone, this.#handleError);
  }

  admit = (admission: {
    open: () => void;
    error: (error: unknown) => void;
  }) => {
    if (this.#lifecycle === "DISPOSED") {
      admission.error(
        new Error("This Silo was disposed before migrations completed."),
      );
      return;
    }
    const status = this.#status.get();

    if (status.state === "ready") {
      admission.open();
      return;
    }

    if (status.state === "error") {
      admission.error(status.error.cause);
      return;
    }

    if (status.state === "migrating") {
      this.#waiting.add(admission);
      return () => {
        this.#waiting.delete(admission);
      };
    }

    assertUnreachable(status);
  };

  dispose = () => {
    if (this.#lifecycle === "DISPOSED") {
      return;
    }
    this.#lifecycle = "DISPOSED";
    this.#waiting.clear();
    this.#status.dispose();
    this.#settlement.reject(
      new Error("This Silo was disposed before migrations completed."),
    );
  };

  #admitWaiting(
    handle: (admission: Parameters<Migrations["admit"]>[0]) => void,
  ) {
    for (const admission of [...this.#waiting]) {
      if (!this.#waiting.delete(admission)) {
        continue;
      }
      isolate(() => handle(admission));
    }
  }

  #runSync(steps: ReturnType<typeof declaredSteps<SyncMigration>>) {
    const options = this.#options;
    const { adapter } = options.backends.default;
    const store = new MigrationStore({
      backends: options.backends,
      keyspaces: options.keyspaces,
      assertActive: this.#assertActive,
    }).synchronous();
    const raw = adapter.get(options.keyspaces.default.version);
    const version = typeof raw === "number" ? raw : 0;
    this.#storedVersion(version);
    for (const step of steps) {
      if (step.version <= version) {
        continue;
      }
      this.#trace("migration step", () => ({ version: step.version }));
      this.#assertActive();
      this.#assertSynchronous(step.run(store), `migration ${step.version}`);
      this.#assertActive();
      this.#assertSynchronous(
        adapter.set(options.keyspaces.default.version, step.version),
        `version ${step.version}`,
      );
      this.#storedVersion(step.version);
    }
  }

  async #runAsync(
    steps: ReturnType<typeof declaredSteps<AsyncMigration>>,
    stored: number | undefined,
  ) {
    const options = this.#options;
    const { adapter } = options.backends.default;
    const store = new MigrationStore({
      backends: options.backends,
      keyspaces: options.keyspaces,
      assertActive: this.#assertActive,
    }).asynchronous();
    const raw = await (stored ??
      adapter.get(options.keyspaces.default.version));
    const version = typeof raw === "number" ? raw : 0;
    this.#storedVersion(version);
    for (const step of steps) {
      if (step.version <= version) {
        continue;
      }
      this.#trace("migration step", () => ({ version: step.version }));
      this.#assertActive();
      await step.run(store);
      this.#assertActive();
      await adapter.set(options.keyspaces.default.version, step.version);
      this.#storedVersion(step.version);
    }
  }

  #assertSynchronous = (result: void | Promise<void>, name: string) => {
    if (!result || typeof result.then !== "function") {
      return;
    }
    // Reject the unsupported operation without leaving its promise unhandled.
    Promise.resolve(result).catch(() => {});
    throw new Error(
      `Silo cannot await ${name} on the synchronous ${this.#options.backends.default.adapter.name} adapter: a step that returns a promise needs an asynchronous adapter.`,
    );
  };

  #handleDone = () => {
    if (this.#lifecycle === "DISPOSED") {
      return;
    }
    this.#settlement.resolve();
    this.#options.diagnostics.changed();
    this.#status.set(READY_SILO_STATUS);
    this.#trace("migration done", () => ({ version: this.#version.stored }));
  };

  #handleError = (cause: unknown) => {
    if (this.#lifecycle === "DISPOSED") {
      return;
    }
    this.#settlement.reject(cause);
    this.#options.diagnostics.changed();
    this.#status.set({ state: "error", error: { phase: "migrate", cause } });
    this.#trace("migration failed", () => ({ cause }));
  };

  #storedVersion(version: number) {
    if (this.#version.stored === version) {
      return;
    }
    this.#version.stored = version;
    this.#options.diagnostics.changed();
    this.#trace("migration version", () => ({ version }));
  }

  #trace = (type: string, context: () => unknown) => {
    const { diagnostics } = this.#options;
    if (!diagnostics.recording) {
      return;
    }
    diagnostics.record({
      source: "migration",
      type,
      storage: null,
      key: null,
      context: context(),
    });
  };

  #assertActive = () => {
    if (this.#lifecycle === "DISPOSED") {
      throw new Error("This Silo was disposed before migrations completed.");
    }
  };
}

// SiloOptions ties callback types to candidate modes, which Backend preserves.
const usesSynchronousMigrations = (
  _migrations: NonNullable<Parameters<Migrations["start"]>[0]>,
  backends: AcquiredStorages["backends"],
): _migrations is Record<number, SyncMigration> =>
  Object.values(backends).every((backend) => backend.execution.mode === "sync");

const declaredSteps = <TMigration>(migrations: Record<number, TMigration>) =>
  Object.entries(migrations)
    .map(([key, run]) => {
      const version = Number(key);
      if (
        !Number.isInteger(version) ||
        version < 1 ||
        String(version) !== key
      ) {
        throw new Error(
          `A Silo migration is keyed by the positive integer version it produces, received "${key}".`,
        );
      }
      return { version, run };
    })
    .sort((left, right) => left.version - right.version);
