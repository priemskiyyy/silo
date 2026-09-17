import type { StorageChange } from "@priemskiyyy/silo";
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { createMockAdapter } from "@priemskiyyy/simulcast/mock";

/**
 * A connected simulcast client over the mock provider, and a way to play the
 * server: `emit` delivers a publication on every live subscription to `name`.
 */
export const createRealtime = (name = "silo") => {
  const mock = createMockAdapter();
  const client = new RealtimeClient({ adapter: mock.adapter });
  client.connect();

  const subscriptions = () =>
    mock.connections.flatMap((connection) =>
      connection.subscriptions.filter(
        (subscription) =>
          subscription.channel === name && subscription.disposeCount === 0,
      ),
    );

  const emit = (data: unknown) => {
    for (const subscription of subscriptions()) {
      subscription.observer.publication({ data, native: null });
    }
  };

  return {
    client,
    channel: client.channel(name),
    connections: mock.connections,
    subscriptions,
    emit,
    // The wire is JSON, so a removal travels as `{ key }` alone.
    announce: (change: StorageChange) =>
      emit(JSON.parse(JSON.stringify(change))),
  };
};
