import type React from "react";
import { dotStyles } from "src/styles/dotStyles";
import type { Tone } from "src/utils/Tone";

type TimelineStep = {
  label: string;
  tone: Tone;
  text: string;
};

type StatusTimelineProps = {
  name: string;
  steps: TimelineStep[];
};

/** Two or more moments of one status on one line: what it was, what it is. */
export const StatusTimeline: React.FunctionComponent<StatusTimelineProps> = ({
  name,
  steps,
}) => (
  <ol aria-label={name} className="flex flex-wrap items-center gap-x-2 gap-y-1">
    {steps.map((step, index) => (
      <li key={step.label} className="flex items-center gap-1.5">
        {index === 0 ? null : (
          <span
            aria-hidden="true"
            className="mr-0.5 h-px w-4 shrink-0 bg-zinc-300 dark:bg-zinc-700"
          />
        )}
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {step.label}
        </span>
        <span aria-hidden="true" className={dotStyles({ tone: step.tone })} />
        <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
          {step.text}
        </span>
      </li>
    ))}
  </ol>
);
