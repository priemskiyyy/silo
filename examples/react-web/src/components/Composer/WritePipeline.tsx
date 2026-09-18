import type React from "react";
import { Check, CircleNotch, PencilLine } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import clsx from "clsx";
import { match } from "ts-pattern";
import type { SaveState } from "src/hooks/useDurableValue";

type WritePipelineProps = {
  save: SaveState<unknown>;
  editing: boolean;
};

type Step = "EDITING" | "WRITING" | "DURABLE";

const STEPS: { step: Step; label: string; icon: Icon }[] = [
  { step: "EDITING", label: "Editing", icon: PencilLine },
  { step: "WRITING", label: "Saving", icon: CircleNotch },
  { step: "DURABLE", label: "Saved", icon: Check },
];

/** The write path as three steps: `set` returns during the first, the adapter works through the second, and `flush()` resolves on the third. */
export const WritePipeline: React.FunctionComponent<WritePipelineProps> = ({
  save,
  editing,
}) => {
  const active = editing
    ? "EDITING"
    : match(save)
        .returnType<Step | null>()
        .with({ state: "IDLE" }, () => null)
        .with({ state: "PENDING" }, () => "WRITING")
        .with({ state: "DURABLE" }, () => "DURABLE")
        .with({ state: "REFUSED" }, () => "WRITING")
        .exhaustive();
  const refused = save.state === "REFUSED";

  return (
    <ol aria-label="Write pipeline" className="flex items-center gap-1 text-xs">
      {STEPS.map(({ step, label, icon: StepIcon }, index) => {
        const isActive = active === step;
        const isRefused = refused && step === "WRITING";

        return (
          <li key={step} className="flex items-center gap-1">
            {index === 0 ? null : (
              <span
                aria-hidden="true"
                className="h-px w-4 bg-zinc-300 dark:bg-zinc-700"
              />
            )}
            <span
              aria-current={isActive ? "step" : undefined}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono",
                isRefused
                  ? "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300"
                  : isActive
                    ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/40 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200"
                    : "border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
              )}
            >
              <StepIcon
                size={12}
                weight="bold"
                className={
                  isActive && step === "WRITING" ? "animate-spin" : undefined
                }
              />
              {isRefused ? "Refused" : label}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
