import { cva } from "class-variance-authority";

/** A storage chip in the Playground: the page's first interaction, so the selected one is unmistakable. */
export const chipStyles = cva(
  "flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  {
    variants: {
      selected: {
        true: "border-amber-500 bg-white shadow-sm ring-2 ring-amber-500/60 dark:border-amber-400 dark:bg-zinc-950",
        false:
          "border-zinc-200 bg-white/60 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
      },
    },
  },
);
