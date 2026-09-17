import type { SiloStatus } from "src/types/SiloStatus";
import type { ValueStatus } from "src/types/ValueStatus";

/**
 * What a store looks like right now, for an inspector: its status and
 * migration version, each storage with the adapter that won its list, and
 * every currently cached record, with the snapshot it holds and
 * how far its writes got. Reading it never hydrates anything.
 *
 * @example
 * ```ts
 * silo.diagnostics.get().records.map((record) => `${record.physicalKey}: ${record.status.state}`);
 * ```
 */
export type SiloSnapshot = {
  status: SiloStatus;
  /** The highest declared migration step, and the stored version once the chain has read it. */
  version: { declared: number; stored: number | null };
  storages: Array<{
    name: string;
    adapter: string;
    mode: "sync" | "async";
    namespace: string;
  }>;
  records: Array<{
    storage: string;
    path: string;
    segments: string[];
    physicalKey: string;
    status: ValueStatus;
    value: unknown;
    writes: { accepted: number; durable: number; inflight: boolean };
  }>;
};
