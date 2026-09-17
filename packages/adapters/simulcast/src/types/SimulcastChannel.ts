/**
 * The subscription contract accepted by the adapter; a RealtimeChannel satisfies it.
 *
 * @example
 * ```ts
 * const channel: SimulcastChannel = realtime.channel("silo");
 * ```
 */
export type SimulcastChannel = {
  subscribe: (
    onPublication: (publication: { data: unknown }) => void,
  ) => () => void;
};
