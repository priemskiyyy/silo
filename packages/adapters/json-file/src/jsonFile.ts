import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createStorageAdapter } from "@priemskiyyy/silo";
import type { JsonFileAdapterOptions } from "src/types/JsonFileAdapterOptions";
import type { JsonFileHandle } from "src/types/JsonFileHandle";

const isMissing = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const isEntry = (item: unknown): item is [string, unknown] =>
  Array.isArray(item) && item.length === 2 && typeof item[0] === "string";

const parse = (text: string, path: string): Map<string, unknown> => {
  if (text.trim() === "") {
    return new Map();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      `The json-file adapter cannot read "${path}": it is not valid JSON.`,
      { cause },
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isEntry)) {
    throw new Error(
      `The json-file adapter cannot read "${path}": expected a JSON array of [key, value] entries.`,
    );
  }

  return new Map(parsed);
};

/**
 * Stores JSON values in one file, loaded lazily and replaced on each write.
 * Use one writer per file; writes are not coordinated across processes.
 *
 * @example
 * ```ts
 * const adapter = jsonFile({ path: "state.json" });
 * ```
 */
export const jsonFile = ({
  path,
  available = () => true,
}: JsonFileAdapterOptions) => {
  const file = resolve(path);
  const native: JsonFileHandle = { path: file };
  let entries: Map<string, unknown> | null = null;

  const load = () => {
    if (entries !== null) {
      return entries;
    }

    let text = "";

    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }

    entries = parse(text, file);
    return entries;
  };

  const save = (current: Map<string, unknown>) => {
    mkdirSync(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify([...current], null, 2));
    renameSync(temporary, file);
    entries = current;
  };

  return createStorageAdapter({
    mode: "sync",
    name: "json-file",
    native,
    get: (key) => structuredClone(load().get(key)),
    set: (key, value) => {
      const current = new Map(load());
      const text = JSON.stringify(value);

      if (text === undefined) {
        current.delete(key);
        save(current);
        return;
      }

      current.set(key, JSON.parse(text));
      save(current);
    },
    remove: (key) => {
      const current = new Map(load());
      current.delete(key);
      save(current);
    },
    keys: () => [...load().keys()],
    available,
    dispose: () => {},
  });
};
