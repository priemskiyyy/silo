import type React from "react";
import type { ValueStatus } from "@priemskiyyy/silo";
import { formatValueStatus } from "src/formatting/formatValueStatus";
import { dotStyles } from "src/styles/dotStyles";

type StatusPillProps = {
  status: ValueStatus;
};

/** A value's status as a dot and a word, the way the devtools show it. */
export const StatusPill: React.FunctionComponent<StatusPillProps> = ({
  status,
}) => {
  const { label, tone } = formatValueStatus(status);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 font-mono text-[11px] text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
      <span aria-hidden="true" className={dotStyles({ tone })} />
      {label}
    </span>
  );
};
