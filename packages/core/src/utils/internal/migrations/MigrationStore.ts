import type { AsyncMigrationStore } from "src/types/AsyncMigrationStore";
import type { StorageAdapter } from "src/types/StorageAdapter";
import type { SyncMigrationStore } from "src/types/SyncMigrationStore";
import { assertUnreachable } from "src/utils/common/assertUnreachable";
import { DEFAULT_STORAGE } from "src/utils/constants/keyspace";
import type { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import type { Keyspaces } from "src/utils/internal/Keyspace";

/** Owns raw namespace access; typed views preserve each migration mode's return types. */
export class MigrationStore {
  #options;

  constructor(options: {
    backends: AcquiredStorages["backends"];
    keyspaces: Keyspaces;
    assertActive: () => void;
  }) {
    this.#options = options;
  }

  synchronous = (): SyncMigrationStore => this.#sync(DEFAULT_STORAGE);

  asynchronous = (): AsyncMigrationStore => this.#async(DEFAULT_STORAGE);

  #sync = (name: string): SyncMigrationStore => {
    const adapter = this.#synchronousAdapter(name);
    const store: SyncMigrationStore = {
      get: (key) => adapter.get(this.#physical(name, key)),
      set: (key, raw) => adapter.set(this.#physical(name, key), raw),
      remove: (key) => adapter.remove(this.#physical(name, key)),
      keys: () => {
        this.#options.assertActive();
        if (typeof adapter.keys !== "function") {
          throw this.#cannotEnumerate(adapter);
        }
        return this.#relative(name, adapter.keys());
      },
      storage: this.#sync,
      // The target key is composed with the target storage's namespace.
      copy: (key, { to = name, as = key } = {}) => {
        const raw = adapter.get(this.#physical(name, key));
        if (raw === undefined) {
          return;
        }
        this.#synchronousAdapter(to).set(this.#physical(to, as), raw);
      },
      move: (key, target = {}) => {
        store.copy(key, target);
        if (this.#same(name, key, target)) {
          return;
        }
        adapter.remove(this.#physical(name, key));
      },
      rename: (from, to) => store.move(from, { as: to }),
    };
    return store;
  };

  #async = (name: string): AsyncMigrationStore => {
    const adapter = this.#named(name);
    const store: AsyncMigrationStore = {
      get: async (key) => adapter.get(this.#physical(name, key)),
      set: async (key, raw) => {
        await adapter.set(this.#physical(name, key), raw);
      },
      remove: async (key) => {
        await adapter.remove(this.#physical(name, key));
      },
      keys: async () => {
        this.#options.assertActive();
        if (typeof adapter.keys !== "function") {
          throw this.#cannotEnumerate(adapter);
        }
        return this.#relative(name, await adapter.keys());
      },
      storage: this.#async,
      copy: async (key, { to = name, as = key } = {}) => {
        const raw = await adapter.get(this.#physical(name, key));
        if (raw === undefined) {
          return;
        }
        await this.#named(to).set(this.#physical(to, as), raw);
      },
      move: async (key, target = {}) => {
        await store.copy(key, target);
        if (this.#same(name, key, target)) {
          return;
        }
        await adapter.remove(this.#physical(name, key));
      },
      rename: (from, to) => store.move(from, { as: to }),
    };
    return store;
  };

  #physical = (name: string, key: string) => {
    this.#options.assertActive();
    return this.#keyspace(name).physical([], key);
  };

  #relative = (name: string, keys: string[]) =>
    keys.flatMap((key) => {
      const stripped = this.#keyspace(name).relative(key);
      if (stripped === null) {
        return [];
      }
      return [stripped];
    });

  #keyspace = (name: string) => {
    const keyspace = this.#options.keyspaces[name];
    if (keyspace === undefined) {
      throw new Error(
        `Silo has no storage named "${name}"; declared: ${Object.keys(this.#options.keyspaces).join(", ")}.`,
      );
    }
    return keyspace;
  };

  #named = (name: string) => {
    this.#options.assertActive();
    const { backends } = this.#options;
    const adapter = backends[name]?.adapter;
    if (adapter === undefined) {
      throw new Error(
        `Silo has no storage named "${name}"; declared: ${Object.keys(backends).join(", ")}.`,
      );
    }
    return adapter;
  };

  #synchronousAdapter = (name: string) => {
    const adapter = this.#named(name);
    if (adapter.mode === "sync") {
      return adapter;
    }
    if (adapter.mode === "async") {
      throw new Error(
        "Synchronous migration access requires synchronous storages.",
      );
    }
    return assertUnreachable(adapter);
  };

  #cannotEnumerate = (adapter: StorageAdapter) =>
    new Error(
      `The ${adapter.name} storage adapter cannot list its keys, so a migration cannot enumerate this namespace.`,
    );

  // Different storage names can refer to the same adapter, and the same key
  // is the same physical key only under the same namespace.
  #same = (
    name: string,
    key: string,
    {
      to = name,
      as = key,
    }: NonNullable<Parameters<SyncMigrationStore["move"]>[1]>,
  ) =>
    this.#named(to) === this.#named(name) &&
    this.#physical(to, as) === this.#physical(name, key);
}
