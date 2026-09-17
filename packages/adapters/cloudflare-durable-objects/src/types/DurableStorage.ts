/**
 * Durable Object storage methods used by the adapter.
 *
 * @example
 * ```ts
 * const storage: DurableStorage = this.ctx.storage;
 * ```
 */
export type DurableStorage = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<Map<string, unknown>>;
};
