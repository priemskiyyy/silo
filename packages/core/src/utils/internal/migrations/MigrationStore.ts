import type { AsyncMigrationStore } from "src/types/AsyncMigrationStore";
import type { SyncMigrationStore } from "src/types/SyncMigrationStore";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { DEFAULT_STORAGE } from "src/utils/constants/keyspace";
import type { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import type { Keyspace, createKeyspaces } from "src/utils/internal/Keyspace";

/** Owns raw namespace access; typed views preserve each migration mode's return types. */
export class MigrationStore {
  #options;

  constructor(options: {
    backends: AcquiredStorages["backends"];
    keyspaces: ReturnType<typeof createKeyspaces>;
    assertActive: () => void;
  }) {
    this.#options = options;
  }

  synchronous = (name = DEFAULT_STORAGE): SyncMigrationStore => {
    const { adapter, keyspace } = this.#synchronousStorage(name);
    const store: SyncMigrationStore = {
      get: (key) => adapter.get(this.#physical(keyspace, key)),
      set: (key, raw) => adapter.set(this.#physical(keyspace, key), raw),
      remove: (key) => adapter.remove(this.#physical(keyspace, key)),
      keys: () => {
        this.#options.assertActive();
        if (typeof adapter.keys !== "function") {
          throw new Error(
            `The ${adapter.name} storage adapter cannot list its keys, so a migration cannot enumerate this namespace.`,
          );
        }
        return this.#relative(keyspace, adapter.keys());
      },
      storage: this.synchronous,
      copy: (key, { to = name, as = key } = {}) => {
        const raw = adapter.get(this.#physical(keyspace, key));
        if (raw === undefined) {
          return;
        }
        const target = this.#synchronousStorage(to);
        target.adapter.set(this.#physical(target.keyspace, as), raw);
      },
      move: (key, target = {}) => {
        store.copy(key, target);
        if (this.#same(name, key, target)) {
          return;
        }
        adapter.remove(this.#physical(keyspace, key));
      },
      rename: (from, to) => store.move(from, { as: to }),
    };
    return store;
  };

  asynchronous = (name = DEFAULT_STORAGE): AsyncMigrationStore => {
    const { adapter, keyspace } = this.#storage(name);
    const store: AsyncMigrationStore = {
      get: async (key) => adapter.get(this.#physical(keyspace, key)),
      set: async (key, raw) => {
        await adapter.set(this.#physical(keyspace, key), raw);
      },
      remove: async (key) => {
        await adapter.remove(this.#physical(keyspace, key));
      },
      keys: async () => {
        this.#options.assertActive();
        if (typeof adapter.keys !== "function") {
          throw new Error(
            `The ${adapter.name} storage adapter cannot list its keys, so a migration cannot enumerate this namespace.`,
          );
        }
        return this.#relative(keyspace, await adapter.keys());
      },
      storage: this.asynchronous,
      copy: async (key, { to = name, as = key } = {}) => {
        const raw = await adapter.get(this.#physical(keyspace, key));
        if (raw === undefined) {
          return;
        }
        const target = this.#storage(to);
        await target.adapter.set(this.#physical(target.keyspace, as), raw);
      },
      move: async (key, target = {}) => {
        await store.copy(key, target);
        if (this.#same(name, key, target)) {
          return;
        }
        await adapter.remove(this.#physical(keyspace, key));
      },
      rename: (from, to) => store.move(from, { as: to }),
    };
    return store;
  };

  #physical(keyspace: Keyspace, key: string) {
    this.#options.assertActive();
    return keyspace.physical([], key);
  }

  #relative(keyspace: Keyspace, keys: string[]) {
    return keys.flatMap((key) => {
      const stripped = keyspace.relative(key);
      if (stripped === null) {
        return [];
      }
      return [stripped];
    });
  }

  #storage(name: string) {
    this.#options.assertActive();
    const { backends, keyspaces } = this.#options;
    const adapter = backends[name]?.adapter;
    const keyspace = keyspaces[name];
    if (adapter === undefined || keyspace === undefined) {
      throw new Error(
        `Silo has no storage named "${name}"; declared: ${Object.keys(backends).join(", ")}.`,
      );
    }
    return { adapter, keyspace };
  }

  #synchronousStorage(name: string) {
    const { adapter, keyspace } = this.#storage(name);
    if (adapter.mode === "sync") {
      return { adapter, keyspace };
    }
    if (adapter.mode === "async") {
      throw new Error(
        "Synchronous migration access requires synchronous storages.",
      );
    }
    return assertUnreachable(adapter);
  }

  // Aliases are the same location only when both adapter and physical key match.
  #same(
    name: string,
    key: string,
    {
      to = name,
      as = key,
    }: NonNullable<Parameters<SyncMigrationStore["move"]>[1]>,
  ) {
    const source = this.#storage(name);
    const target = this.#storage(to);
    return (
      source.adapter === target.adapter &&
      this.#physical(source.keyspace, key) ===
        this.#physical(target.keyspace, as)
    );
  }
}
