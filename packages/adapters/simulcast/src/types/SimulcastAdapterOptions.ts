import type { StorageChange } from "@priemskiyyy/silo";
import type { SimulcastChannel } from "src/types/SimulcastChannel";

/**
 * Options for `simulcast()`.
 *
 * @example
 * ```ts
 * const options: SimulcastAdapterOptions<AsyncStorageAdapter<HttpHandle>> = {
 *   adapter: http({ url: "https://api.example.com/kv" }),
 *   channel: realtime.channel("silo"),
 * };
 * ```
 */
export type SimulcastAdapterOptions<TAdapter> = {
  adapter: TAdapter;
  channel: SimulcastChannel;
  publish?: (change: StorageChange) => void | Promise<unknown>;
  available?: () => boolean;
};
