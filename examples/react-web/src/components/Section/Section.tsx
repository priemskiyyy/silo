import type React from "react";
import type { ReactNode } from "react";
import { SECTIONS } from "src/components/Section/sections";
import type { SectionId } from "src/components/Section/sections";

type SectionProps = {
  id: SectionId;
  /** What to do, after "Try:". */
  hint: string;
  children: ReactNode;
};

/** One numbered step of the tour: an amber circle, a title and what to try, on one line where it fits. */
export const Section: React.FunctionComponent<SectionProps> = ({
  id,
  hint,
  children,
}) => {
  const { number, title } = SECTIONS[id];

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-20 flex-col gap-3"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-sm font-semibold text-white tabular-nums dark:bg-amber-400 dark:text-zinc-950"
        >
          {number}
        </span>
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-amber-700 dark:text-amber-300">
            Try:
          </span>{" "}
          {hint}
        </p>
      </header>
      {children}
    </section>
  );
};
