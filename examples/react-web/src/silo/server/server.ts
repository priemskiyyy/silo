import { createFakeServer } from "src/silo/server/createFakeServer";

/** The page's one server, outside the store so its log and latency survive a rebuild. */
export const server = createFakeServer({ channel: "fieldbook" });
