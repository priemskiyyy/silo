import type { NativeOf } from "src/types/NativeOf";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { StorageChange } from "src/types/StorageChange";
import type { Storages } from "src/types/Storages";
import { Lifetime } from "src/utils/common/Lifetime";
import { Backend } from "src/utils/internal/adapter/Backend";

/** Owns candidate selection, native handles, and adapter cleanup. */
export class AcquiredStorages<TStorages extends Storages = Storages> {
  #lifetime = new Lifetime();
  #observations = new Lifetime();
  #listener: ((storage: string, change: StorageChange) => void) | undefined;

  backends;
  native: NativeOf<TStorages>;

  constructor(storages: TStorages) {
    const acquired = this.#lifetime.setup(() => {
      const releases = new Map<StorageAdapter, () => void>();
      for (const { adapters } of Object.values(storages)) {
        for (const adapter of adapters) {
          if (releases.has(adapter)) {
            continue;
          }
          releases.set(
            adapter,
            this.#lifetime.add(() => adapter.dispose()),
          );
        }
      }
      this.#lifetime.add(this.stopObserving);

      const backends = new Map<string, Backend>();
      const native = new Map<string, unknown>();
      for (const [name, { adapters }] of Object.entries(storages)) {
        if (adapters.length === 0) {
          throw new Error("A Silo needs at least one adapter.");
        }
        const failures: Error[] = [];
        let selected: { adapter: StorageAdapter; native: unknown } | undefined;
        for (const adapter of adapters) {
          try {
            if (!adapter.available()) {
              failures.push(
                new Error(`Adapter "${adapter.name}" is unavailable.`),
              );
              continue;
            }
            const handle = adapter.native;
            this.#observe(name, adapter);
            selected = { adapter, native: handle };
            break;
          } catch (cause) {
            failures.push(
              new Error(`Adapter "${adapter.name}" failed to initialize.`, {
                cause,
              }),
            );
          }
        }
        if (selected === undefined) {
          throw new AggregateError(
            failures,
            `No adapter could initialize storage "${name}".`,
          );
        }
        const { adapter } = selected;
        backends.set(
          name,
          new Backend({
            adapter,
            execution: {
              mode: adapters.some((candidate) => candidate.mode === "async")
                ? "async"
                : "sync",
            },
          }),
        );
        native.set(name, selected.native);
      }

      const selected = new Set(
        [...backends.values()].map((backend) => backend.adapter),
      );
      for (const [adapter, release] of releases) {
        if (selected.has(adapter)) {
          continue;
        }
        release();
      }
      const primary = backends.get("default");
      if (primary === undefined) {
        throw new Error("A Silo needs a default storage.");
      }
      return {
        backends: Object.assign(Object.fromEntries(backends), {
          default: primary,
        }),
        native: Object.fromEntries(native),
      };
    });

    this.backends = acquired.backends;
    // Enumeration loses the storage-to-native type relationship preserved by selection.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.native = acquired.native as NativeOf<TStorages>;
  }

  dispose = this.#lifetime.dispose;

  observe(listener: (storage: string, change: StorageChange) => void) {
    this.#listener = listener;
  }

  stopObserving = () => {
    this.#listener = undefined;
    this.#observations.dispose();
  };

  #observe(storage: string, adapter: StorageAdapter) {
    if (typeof adapter.observe !== "function") {
      return;
    }
    let active = false;
    const stop = adapter.observe((change) => {
      if (!active) {
        return;
      }
      this.#listener?.(storage, change);
    });
    active = true;
    this.#observations.add(() => {
      active = false;
      stop();
    });
  }
}
