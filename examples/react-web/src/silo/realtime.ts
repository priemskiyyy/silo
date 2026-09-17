import { RealtimeClient } from "@priemskiyyy/simulcast";
import { broadcastChannel } from "@priemskiyyy/simulcast-broadcast-channel";

/**
 * One realtime client for the page, connected for its lifetime. A
 * BroadcastChannel needs no server, so the other tabs stand in for the other
 * devices a real deployment would announce to.
 */
export const realtime = new RealtimeClient({ adapter: broadcastChannel() });

realtime.connect();
