// Typechecked, never imported: a real simulcast channel must fit
// `SimulcastChannel` with no cast, or the structural type has drifted from
// the library it names.
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { createMockAdapter } from "@priemskiyyy/simulcast/mock";
import type { SimulcastChannel } from "src/types/SimulcastChannel";

const realtime = new RealtimeClient({
  // Native types stand in for a provider's own, the way an application
  // registers them.
  adapter: createMockAdapter<{ id: string }, { data: unknown }>().adapter,
});

export const channel: SimulcastChannel = realtime.channel("silo");
