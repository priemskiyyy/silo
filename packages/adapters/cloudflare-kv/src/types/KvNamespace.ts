/**
 * Workers KV methods used by the adapter. Reads use text mode to preserve stored null.
 *
 * @example
 * ```ts
 * const namespace: KvNamespace = env.SETTINGS;
 * ```
 */
export type KvNamespace = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
};
