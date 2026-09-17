import { cva } from "class-variance-authority";

/** The rounded amber tile every panel header and storage row opens with. */
export const iconTileStyles = cva(
  "inline-flex shrink-0 items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  {
    variants: {
      size: {
        regular: "size-9 rounded-xl",
        small: "size-7 rounded-lg",
      },
    },
  },
);
