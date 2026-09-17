/**
 * The Store and LazyStore methods used by the adapter. Missing values and deletions use undefined.
 *
 * @example
 * ```ts
 * import { Store } from "@tauri-apps/plugin-store";
 *
 * const store: TauriStore = await Store.load("state.json");
 * ```
 */
export type TauriStore = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  delete: (key: string) => Promise<boolean>;
  keys: () => Promise<string[]>;
  onChange: (
    listener: (key: string, value: unknown) => void,
  ) => Promise<() => void>;
};
