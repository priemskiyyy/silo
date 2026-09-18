import type { DefinitionOf } from "src/types/DefinitionOf";
import type { InferValue } from "src/types/InferValue";
import type { KeyOf } from "src/types/KeyOf";
import type { NativeOf } from "src/types/NativeOf";
import type { ObservableValue } from "src/types/ObservableValue";
import type { SiloDiagnostics } from "src/types/SiloDiagnostics";
import type { SiloOptions } from "src/types/SiloOptions";
import type { SiloScope } from "src/types/SiloScope";
import type { SiloSnapshot } from "src/types/SiloSnapshot";
import type { SiloStatus } from "src/types/SiloStatus";
import type { SiloValue } from "src/types/SiloValue";
import type { Storages } from "src/types/Storages";
import { Lifetime } from "src/utils/common/Lifetime";
import { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import { createKeyspaces, Keyspace } from "src/utils/internal/Keyspace";
import { Diagnostics } from "src/utils/internal/Diagnostics";
import { Migrations } from "src/utils/internal/migrations/Migrations";
import { SiloValues } from "src/utils/internal/values/SiloValues";

/**
 * Owns an application's storages, migrations, and scoped values.
 * Default storage keys are addressed bare; other keys use `storage.key`.
 *
 * @example
 * ```ts
 * const silo = new Silo({
 *   storages: {
 *     default: { adapters: [localStorage(), memory()], schema: { theme: value<Theme>({ fallback: "light" }) } },
 *     secure: { adapters: [indexedDb(), memory()], schema: { token: value<string>() } },
 *   },
 * });
 * silo.value("theme").set("dark");
 * silo.value("secure.token").set(token);
 * await silo.scope(`users:${userId}`).clear();
 * ```
 */
export class Silo<TStorages extends Storages = Storages> {
  #migrations;
  #values;
  #lifetime = new Lifetime();
  #diagnostics = new Diagnostics(() => this.#inspect());

  /** Native clients by storage name, stable for the store's lifetime. */
  native: NativeOf<TStorages>;

  /** Migration progress and failures. */
  status: ObservableValue<SiloStatus>;

  /** The inspector's view: a snapshot of every storage and record, and a stream of events. Observing creates no demand. */
  diagnostics: SiloDiagnostics = this.#diagnostics.api;

  constructor(options: SiloOptions<TStorages>) {
    // Reverse cleanup stops observation and values before migrations and adapters.
    const acquired = this.#lifetime.setup(() => {
      const storages = new AcquiredStorages(options.storages);
      this.#lifetime.add(storages.dispose);
      const { backends, native } = storages;
      // After the winners are known: the medium that won has a say in the
      // namespace, and a bad key still undoes the acquisition.
      const keyspaces = createKeyspaces({
        storages: options.storages,
        adapters: backends,
        namespace: options.namespace,
      });
      const migrations = new Migrations({
        backends,
        keyspaces,
        diagnostics: this.#diagnostics,
      });
      this.#lifetime.add(migrations.dispose);
      const values = new SiloValues({
        storages: options.storages,
        backends,
        keyspaces,
        now: options.now ?? Date.now,
        admit: migrations.admit,
        diagnostics: this.#diagnostics,
      });
      this.#lifetime.add(values.dispose);

      for (const [name, { adapter }] of Object.entries(backends)) {
        if (typeof adapter.observe !== "function") {
          continue;
        }

        // Binding avoids retaining constructor options through an observer closure.
        this.#lifetime.add(
          adapter.observe(values.handleStorageChange.bind(values, name)),
        );
      }

      migrations.start(options.migrations);
      return { native, migrations, values };
    });

    this.#migrations = acquired.migrations;
    this.#values = acquired.values;
    this.native = acquired.native;
    this.status = acquired.migrations.status;
  }

  /** The value at the root scope, memoized per key. */
  value = <TKey extends KeyOf<TStorages>>(
    key: TKey,
  ): SiloValue<InferValue<DefinitionOf<TStorages, TKey>>> =>
    this.#values.acquire(key, []);

  /** Addresses the same storages under a validated key prefix. */
  scope = (segment: string): SiloScope<TStorages> => this.#scope([], segment);

  clear = (): Promise<void> => this.#values.clear([]);

  /**
   * Flushes and releases cached records without deleting stored data.
   * Existing value handles become inactive; acquiring a value hydrates a new record.
   * @example `await silo.scope("documents:7").release();`
   */
  release = (): Promise<void> => this.#values.release([]);

  /** Resolves when every accepted mutation has reached its adapter. */
  flush = (): Promise<void> => this.#values.flush();

  /** Resolves after migrations, or rejects with their failure. */
  ready = (): Promise<void> => this.#migrations.ready;

  /** Synchronously releases owned resources. Repeated calls do nothing. */
  dispose = () => {
    if (this.#lifetime.disposed) {
      return;
    }
    try {
      this.#lifetime.dispose();
    } finally {
      this.#diagnostics.dispose();
    }
  };

  #inspect(): SiloSnapshot {
    return {
      status: this.#migrations.status.get(),
      version: this.#migrations.inspectVersion(),
      ...this.#values.inspect(),
    };
  }

  #scope = (parents: string[], segment: string): SiloScope<TStorages> => {
    Keyspace.assertSegment(segment);
    const segments = [...parents, segment];

    return {
      value: (key) => this.#values.acquire(key, segments),
      scope: (child) => this.#scope(segments, child),
      clear: () => this.#values.clear(segments),
      release: () => this.#values.release(segments),
    };
  };
}
