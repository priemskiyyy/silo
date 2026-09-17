import type { ServerLatency } from "src/silo/server/ServerLatency";

/** Milliseconds as people say them: `0 ms`, `400 ms`, `1.5 s`. */
export const formatLatency = (latency: ServerLatency) => {
  if (latency >= 1_000) {
    return `${latency / 1_000} s`;
  }

  return `${latency} ms`;
};
