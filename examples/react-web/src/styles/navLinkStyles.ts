import { cva } from "class-variance-authority";

/** One numbered link in the sticky step nav; the step being read is amber. */
export const navLinkStyles = cva(
  "inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  {
    variants: {
      current: {
        true: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
        false:
          "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
      },
    },
  },
);
