import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-zinc-900 text-white shadow-sm hover:bg-zinc-700 dark:bg-amber-400 dark:text-zinc-950 dark:hover:bg-amber-300",
        secondary:
          "border border-zinc-300 bg-white shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
        ghost:
          "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
      },
      pressed: {
        true: "border-amber-500 text-amber-800 ring-2 ring-amber-500/60 dark:border-amber-400 dark:text-amber-300",
        false: "",
      },
      size: {
        regular: "h-9 px-3 text-sm",
        small: "h-7 px-2 text-xs",
        icon: "size-9 text-sm",
      },
    },
    defaultVariants: { variant: "secondary", pressed: false, size: "regular" },
  },
);
