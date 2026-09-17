import type { NativeOf } from "src/types/NativeOf";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { Storages } from "src/types/Storages";
import { Lifetime } from "src/utils/common/Lifetime";
import { Backend } from "src/utils/internal/adapter/Backend";

/** Owns candidate selection, native handles, and adapter cleanup. */
export class AcquiredStorages<TStorages extends Storages = Storages> {
  #lifetime = new Lifetime();

  backends: { default: Backend; [name: string]: Backend };
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

      const backends = new Map<string, Backend>();
      const native = new Map<string, unknown>();
      for (const [name, { adapters }] of Object.entries(storages)) {
        let adapter = adapters.at(-1);
        if (adapter === undefined) {
          throw new Error("A Silo needs at least one adapter.");
        }
        // The last candidate is the unconditional fallback; only earlier ones are probed.
        for (const candidate of adapters.slice(0, -1)) {
          if (!candidate.available()) {
            continue;
          }
          adapter = candidate;
          break;
        }
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
        native.set(name, adapter.native);
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
        backends: { ...Object.fromEntries(backends), default: primary },
        native: Object.fromEntries(native),
      };
    });

    this.backends = acquired.backends;
    // Enumeration loses the storage-to-native type relationship preserved by selection.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.native = acquired.native as NativeOf<TStorages>;
  }

  dispose = () => this.#lifetime.dispose();
}
