import type { DefinitionOf } from "src/types/DefinitionOf";
import type { InferValue } from "src/types/InferValue";
import type { KeyOf } from "src/types/KeyOf";
import type { SiloSnapshot } from "src/types/SiloSnapshot";
import type { SiloValue } from "src/types/SiloValue";
import type { StorageChange } from "src/types/StorageChange";
import type { Storages } from "src/types/Storages";
import { DEFAULT_STORAGE, PATH_SEPARATOR } from "src/utils/constants/keyspace";
import type { Backend } from "src/utils/internal/adapter/Backend";
import type { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import type { Keyspace, createKeyspaces } from "src/utils/internal/Keyspace";
import type { Diagnostics } from "src/utils/internal/Diagnostics";
import type { Migrations } from "src/utils/internal/migrations/Migrations";
import { ValueCodec } from "src/utils/internal/values/ValueCodec";
import { ValueRecord } from "src/utils/internal/values/ValueRecord";

type Backing = {
  name: string;
  backend: Backend;
  keyspace: Keyspace;
  records: Map<string, ValueRecord>;
};

/** Shares one record per storage and physical key across all scope handles. */
export class SiloValues<TStorages extends Storages> {
  #admit;
  #diagnostics;
  #backings = new Map<string, Backing>();
  #entries = new Map<
    string,
    {
      key: string;
      codec: ValueCodec;
      backing: Backing;
    }
  >();
  #disposed = false;

  constructor({
    storages,
    backends,
    keyspaces,
    now,
    admit,
    diagnostics,
  }: {
    storages: TStorages;
    backends: AcquiredStorages["backends"];
    keyspaces: ReturnType<typeof createKeyspaces>;
    now: () => number;
    admit: Migrations["admit"];
    diagnostics: Pick<Diagnostics, "changed" | "record" | "recording">;
  }) {
    this.#admit = admit;
    this.#diagnostics = diagnostics;

    for (const [name, { schema: Schema }] of Object.entries(storages)) {
      const backend = backends[name];
      const keyspace = keyspaces[name];

      if (backend === undefined || keyspace === undefined) {
        throw new Error(`Silo chose no adapter for the storage "${name}".`);
      }

      const backing = {
        name,
        backend,
        keyspace,
        records: new Map<string, ValueRecord>(),
      };
      this.#backings.set(name, backing);

      for (const [key, definition] of Object.entries(Schema)) {
        const path =
          name === DEFAULT_STORAGE ? key : `${name}${PATH_SEPARATOR}${key}`;
        this.#entries.set(path, {
          key,
          codec: new ValueCodec({ definition, now }),
          backing,
        });
      }
    }
  }

  acquire<TKey extends KeyOf<TStorages>>(
    path: TKey,
    segments: string[],
  ): SiloValue<InferValue<DefinitionOf<TStorages, TKey>>> {
    const record = this.#record(path, segments);
    record.hydrate();
    return typedValue(record);
  }

  async clear(segments: string[]): Promise<void> {
    this.#assertActive();
    // Skip hydration for records that are about to be removed.
    const records = [...this.#entries.keys()].map((path) =>
      this.#record(path, segments),
    );
    records.forEach((record) => record.remove());
    return this.#barrier(records);
  }

  async flush(): Promise<void> {
    this.#assertActive();
    await Promise.all(
      [...this.#backings.values()].map(({ records }) =>
        this.#barrier(records.values()),
      ),
    );
  }

  async release(segments: string[]): Promise<void> {
    while (true) {
      this.#assertActive();
      const selected = this.#select(segments);
      if (selected.length === 0) {
        return;
      }
      const waiting = selected.flatMap(({ record }) => {
        if (!record.dirty) {
          return [];
        }
        return [record.flush()];
      });
      if (waiting.length > 0) {
        await Promise.all(waiting);
        continue;
      }
      for (const { backing, key, record } of selected) {
        record.dispose("This Silo scope was released");
        backing.records.delete(key);
      }
      this.#diagnostics.changed();
      if (this.#diagnostics.recording) {
        this.#diagnostics.record({
          source: "store",
          type: "scope released",
          storage: null,
          key: null,
          context: { segments: [...segments] },
        });
      }
      return;
    }
  }

  inspect() {
    const storages: SiloSnapshot["storages"] = [];
    const records: SiloSnapshot["records"] = [];
    for (const backing of this.#backings.values()) {
      const { name, backend, keyspace } = backing;
      storages.push({
        name,
        adapter: backend.adapter.name,
        mode: backend.execution.mode,
        namespace: keyspace.namespace,
      });
      for (const record of backing.records.values()) {
        records.push(record.inspect());
      }
    }
    return { storages, records };
  }

  handleStorageChange(storage: string, change: StorageChange) {
    const records = this.#backings.get(storage)?.records;

    if (this.#disposed || records === undefined) {
      return;
    }

    if (change.key === null) {
      [...records.values()].forEach((record) => record.reload());
      return;
    }

    records.get(change.key)?.receive(change.value);
  }

  dispose = () => {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    for (const backing of this.#backings.values()) {
      backing.records.forEach((record) => record.dispose());
      backing.records.clear();
    }
    this.#entries.clear();
    this.#diagnostics.changed();
  };

  #assertActive() {
    if (this.#disposed) {
      throw new Error("This Silo was disposed.");
    }
  }

  #select(segments: string[]) {
    const selected: Array<{
      backing: Backing;
      key: string;
      record: ValueRecord;
    }> = [];
    for (const backing of this.#backings.values()) {
      for (const [key, record] of backing.records) {
        if (!record.isInScope(segments)) {
          continue;
        }
        selected.push({ backing, key, record });
      }
    }
    return selected;
  }

  #record(path: string, segments: string[]) {
    this.#assertActive();
    const entry = this.#entries.get(path);

    if (entry === undefined) {
      throw new Error(`Silo has no value named "${path}" in its storages.`);
    }

    const { backing, codec } = entry;
    const key = backing.keyspace.physical(segments, entry.key);
    const existing = backing.records.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const record = new ValueRecord({
      key,
      identity: { storage: backing.name, path, segments: [...segments] },
      codec,
      backend: backing.backend,
      admit: this.#admit,
      diagnostics: this.#diagnostics,
    });
    backing.records.set(key, record);
    this.#diagnostics.changed();
    if (this.#diagnostics.recording) {
      this.#diagnostics.record({
        source: "value",
        type: "record created",
        storage: backing.name,
        key,
        context: { path, segments: [...segments] },
      });
    }
    return record;
  }

  #barrier(records: Iterable<ValueRecord>): Promise<void> {
    const waiting: Promise<void>[] = [];
    for (const record of records) {
      if (!record.dirty) {
        continue;
      }
      waiting.push(record.flush());
    }
    return Promise.all(waiting).then(() => {});
  }
}

// The overload restores a schema-resolved value type after heterogeneous records share one map.
function typedValue<TValue>(record: ValueRecord): SiloValue<TValue>;
function typedValue(record: ValueRecord): SiloValue<unknown> {
  return record.handle;
}
