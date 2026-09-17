/** How long the fake server sleeps before answering, in milliseconds; the Lab picks one. */
export const SERVER_LATENCIES = [0, 400, 1500] as const;

export type ServerLatency = (typeof SERVER_LATENCIES)[number];
