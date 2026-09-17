import { cva } from "class-variance-authority";

/** A shimmering placeholder while a value hydrates, sized like the control it stands in for. */
export const skeletonStyles = cva(
  "animate-pulse bg-zinc-200 dark:bg-zinc-800",
  {
    variants: {
      variant: {
        field: "block h-9 w-full rounded-lg",
        line: "inline-block h-4 w-24 rounded align-middle",
      },
    },
  },
);
