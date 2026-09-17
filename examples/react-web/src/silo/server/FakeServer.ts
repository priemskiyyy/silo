import type { StorageChange } from "@priemskiyyy/silo";
import type { ServerLatency } from "src/silo/server/ServerLatency";
import type { ServerRequest } from "src/silo/server/ServerRequest";

export type ServerState = {
  latency: ServerLatency;
  /** The next request answers 503, once. */
  armed: boolean;
  /** Newest first. */
  requests: ServerRequest[];
};

/** A REST key-value server that lives in the page: `fetch` goes to the http adapter, the rest to the Server card. */
export type FakeServer = {
  /** The base URL the http adapter is pointed at. */
  url: string;
  /** The BroadcastChannel name every announcement is posted on. */
  channel: string;
  fetch: typeof fetch;
  /** Tells the other tabs about a write this tab made; the simulcast adapter calls it after each one lands. */
  announce: (change: StorageChange) => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ServerState;
  setLatency: (latency: ServerLatency) => void;
  failNextRequest: () => void;
  clearLog: () => void;
};
