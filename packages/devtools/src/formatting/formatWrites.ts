import type { SiloSnapshot } from "@priemskiyyy/silo";

/** `writing` while one is in flight, otherwise how many were accepted and how many landed. */
export const formatWrites = (
  writes: SiloSnapshot["records"][number]["writes"],
) => {
  if (writes.inflight) {
    return "writing";
  }

  if (writes.accepted === 0) {
    return "no writes";
  }

  return `${writes.accepted} accepted / ${writes.durable} durable`;
};
