/** One request the fake server answered, the way an access log would print it. */
export type ServerRequest = {
  id: number;
  method: string;
  path: string;
  status: number;
  /** Milliseconds from the request to the response, latency included. */
  duration: number;
};
