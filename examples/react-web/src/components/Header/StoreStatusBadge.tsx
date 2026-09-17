import type React from "react";
import { useSiloStatus } from "@priemskiyyy/silo-react";
import { formatSiloStatus } from "src/formatting/formatSiloStatus";
import { dotStyles } from "src/styles/dotStyles";

/** The store's own progress: the migration gate, which a warm start opens before the first render. */
export const StoreStatusBadge: React.FunctionComponent = () => {
  const { label, tone } = formatSiloStatus(useSiloStatus());

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-2.5 py-0.5 font-mono text-[11px] dark:border-zinc-700">
      <span aria-hidden="true" className={dotStyles({ tone })} />
      {label}
    </span>
  );
};
