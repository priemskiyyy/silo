import type React from "react";
import { Bug, CloudArrowUp, Eraser, Receipt } from "@phosphor-icons/react";
import clsx from "clsx";
import { useSyncExternalStore } from "react";
import { match } from "ts-pattern";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { Panel } from "src/components/Panel/Panel";
import { SegmentedControl } from "src/components/SegmentedControl/SegmentedControl";
import { formatLatency } from "src/formatting/formatLatency";
import { SERVER_LATENCIES } from "src/silo/server/ServerLatency";
import { server } from "src/silo/server/server";
import { buttonStyles } from "src/styles/buttonStyles";

const LATENCY_OPTIONS = SERVER_LATENCIES.map((latency) => ({
  value: latency,
  label: formatLatency(latency),
}));

/** The fake server's side of the Remote storage: its latency, a fault, and the requests the http adapter sent. */
export const ServerCard: React.FunctionComponent = () => {
  const { latency, armed, requests } = useSyncExternalStore(
    server.subscribe,
    server.getSnapshot,
  );

  return (
    <Panel
      title="Server"
      icon={CloudArrowUp}
      shows="A REST key-value server in this page: the http adapter's requests, and an announcement to the other tabs after each write."
      aside={
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {server.url}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Latency</span>
        <SegmentedControl
          label="Latency"
          options={LATENCY_OPTIONS}
          value={latency}
          onSelect={server.setLatency}
        />
        <button
          type="button"
          disabled={requests.length === 0}
          onClick={server.clearLog}
          className={`${buttonStyles({ size: "small" })} sm:ml-auto`}
        >
          <Eraser size={12} weight="bold" />
          Clear log
        </button>
        <button
          type="button"
          aria-pressed={armed}
          onClick={server.failNextRequest}
          className={buttonStyles({ pressed: armed, size: "small" })}
        >
          <Bug size={12} weight="bold" />
          Fail next request
        </button>
      </div>
      {requests.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No requests yet"
          description="Choose Remote in Storages and type a note. Its requests appear here, newest first."
        />
      ) : (
        <ol
          aria-label="Requests"
          className="flex max-h-36 flex-col divide-y divide-zinc-200/70 overflow-y-auto font-mono text-xs dark:divide-zinc-800"
        >
          {requests.map((request) => (
            <li
              key={request.id}
              className="grid shrink-0 grid-cols-[3.5rem_minmax(0,1fr)_2.5rem_4rem] items-center gap-2 py-1.5"
            >
              <span className="font-semibold">{request.method}</span>
              <span className="truncate text-zinc-600 dark:text-zinc-300">
                {request.path}
              </span>
              <span
                className={clsx(
                  "font-semibold tabular-nums",
                  match(request.status)
                    .when(
                      (status) => status < 400,
                      () => "text-emerald-600 dark:text-emerald-400",
                    )
                    .otherwise(() => "text-rose-600 dark:text-rose-400"),
                )}
              >
                {request.status}
              </span>
              <span className="text-right text-zinc-500 tabular-nums dark:text-zinc-400">
                {request.duration} ms
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
};
