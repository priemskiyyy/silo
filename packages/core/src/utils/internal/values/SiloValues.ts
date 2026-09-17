import type { DefinitionOf } from "src/types/DefinitionOf";
import type { InferValue } from "src/types/InferValue";
import type { KeyOf } from "src/types/KeyOf";
import type { SiloSnapshot } from "src/types/SiloSnapshot";
import type { SiloValue } from "src/types/SiloValue";
import type { StorageChange } from "src/types/StorageChange";
import type { Storages } from "src/types/Storages";
import type { ValueDefinition } from "src/types/ValueDefinition";
import { DEFAULT_STORAGE, PATH_SEPARATOR } from "src/utils/constants/keyspace";
import type { Backend } from "src/utils/internal/adapter/Backend";
import type { AcquiredStorages } from "src/utils/internal/adapter/AcquiredStorages";
import type { Keyspace, Keyspaces } from "src/utils/internal/Keyspace";
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

type Entry = {
  key: string;
  definition: ValueDefinition<unknown>;
  codec: ValueCodec;
  backing: Backing;
};

/** Shares one record per storage and physical key across all scope handles. */
export class SiloValues<TStorages extends Storages> {
  #admit;
  #diagnostics;
  #backings = new Map<string, Backing>();
  #entries = new Map<string, Entry>();
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
    keyspaces: Keyspaces;
    now: () => number;
    admit: Migrations["admit"];
    diagnostics: Pick<Diagnostics, "changed" | "record" | "recording">;
  }) {
    this.#admit = admit;
    this.#diagnostics = diagnostics;

    for (const [name, { schema }] of Object.entries(storages)) {
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

      for (const [key, definition] of Object.entries(schema)) {
        const path =
          name === DEFAULT_STORAGE ? key : `${name}${PATH_SEPARATOR}${key}`;
        this.#entries.set(path, {
          key,
          definition,
          codec: new ValueCodec({ definition, now }),
          backing,
        });
      }
    }
  }

  acquire = <TKey extends KeyOf<TStorages>>(
    path: TKey,
    segments: string[],
  ): SiloValue<InferValue<DefinitionOf<TStorages, TKey>>> => {
    const record = this.#record(path, segments);
    record.hydrate();
    return typedValue(record);
  };

  clear = async (segments: string[]): Promise<void> => {
    this.#assertActive();
    // Skip hydration for records that are about to be removed.
    const records = [...this.#entries.keys()].map((path) =>
      this.#record(path, segments),
    );
    records.forEach((record) => record.remove());
    return this.#barrier(records);
  };

  flush = async (): Promise<void> => {
    this.#assertActive();
    return this.#barrier(this.#all());
  };

  release = async (segments: string[]): Promise<void> => {
    while (true) {
      this.#assertActive();
      const selected = this.#select(segments);
      const dirty = selected.flatMap(({ record }) => {
        if (!record.dirty) {
          return [];
        }
        return [record];
      });
      if (dirty.length > 0) {
        await this.#barrier(dirty);
        continue;
      }
      for (const { backing, key, record } of selected) {
        record.dispose("This Silo scope was released");
        backing.records.delete(key);
      }
      if (selected.length === 0) {
        return;
      }
      this.#diagnostics.changed();
      if (this.#diagnostics.recording) {
        this.#diagnostics.record({
          source: "store",
          type: "scope released",
          storage: null,
          key: null,
          context: { segments },
        });
      }
      return;
    }
  };

  inspect = (): SiloSnapshot["records"] => {
    const records: SiloSnapshot["records"] = [];
    for (const backing of this.#backings.values()) {
      for (const record of backing.records.values()) {
        records.push(record.inspect());
      }
    }
    return records;
  };

  handleStorageChange = (storage: string, change: StorageChange) => {
    const records = this.#backings.get(storage)?.records;

    if (this.#disposed || records === undefined) {
      return;
    }

    if (change.key === null) {
      [...records.values()].forEach((record) => record.reload());
      return;
    }

    records.get(change.key)?.receive(change.value);
  };

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

  #assertActive = () => {
    if (this.#disposed) {
      throw new Error("This Silo was disposed.");
    }
  };

  #all = () =>
    [...this.#backings.values()].flatMap((backing) => [
      ...backing.records.values(),
    ]);

  #select(segments: string[]) {
    const selected: Array<{
      backing: Backing;
      key: string;
      record: ValueRecord;
    }> = [];
    for (const backing of this.#backings.values()) {
      for (const [key, record] of backing.records) {
        if (!backing.keyspace.contains(segments, key)) {
          continue;
        }
        selected.push({ backing, key, record });
      }
    }
    return selected;
  }

  #record = (path: string, segments: string[]): ValueRecord => {
    this.#assertActive();
    const entry = this.#entries.get(path);

    if (entry === undefined) {
      throw new Error(`Silo has no value named "${path}" in its storages.`);
    }

    const key = entry.backing.keyspace.physical(segments, entry.key);
    const existing = entry.backing.records.get(key);

    if (existing !== undefined) {
      return existing;
    }

    const record = new ValueRecord({
      key,
      identity: { storage: entry.backing.name, path, segments: [...segments] },
      definition: entry.definition,
      codec: entry.codec,
      backend: entry.backing.backend,
      admit: this.#admit,
      diagnostics: this.#diagnostics,
    });
    entry.backing.records.set(key, record);
    if (this.#diagnostics.recording) {
      this.#diagnostics.record({
        source: "value",
        type: "record created",
        storage: entry.backing.name,
        key,
        context: { path, segments },
      });
    }
    this.#diagnostics.changed();
    return record;
  };

  #barrier = (records: ValueRecord[]): Promise<void> => {
    const waiting: Promise<void>[] = [];
    for (const record of records) {
      if (!record.dirty) {
        continue;
      }
      waiting.push(record.flush());
    }
    return Promise.all(waiting).then(() => {});
  };
}

// The overload restores a schema-resolved value type after heterogeneous records share one map.
function typedValue<TValue>(record: ValueRecord): SiloValue<TValue>;
function typedValue(record: ValueRecord): SiloValue<unknown> {
  return record.handle;
}
