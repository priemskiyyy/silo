import { cva } from "class-variance-authority";

/** One option of a segmented pill; the selected one is raised and ringed amber. The group is a `role="group"` of pressable buttons. */
export const segmentStyles = cva(
  "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  {
    variants: {
      selected: {
        true: "bg-white text-zinc-900 shadow-sm ring-2 ring-amber-500/60 dark:bg-zinc-950 dark:text-zinc-100",
        false:
          "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
      },
    },
  },
);
