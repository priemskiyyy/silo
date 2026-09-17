/**
 * Options for `jsonFile()`.
 *
 * @example
 * ```ts
 * const adapter = jsonFile({ path: "./data/state.json" });
 * ```
 */
export type JsonFileAdapterOptions = {
  /** The file to read and write, resolved against the working directory. Created on the first write, parent folders included. */
  path: string;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
};
