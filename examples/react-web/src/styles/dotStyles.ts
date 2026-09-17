import { cva } from "class-variance-authority";
import type { Tone } from "src/utils/Tone";

/** The status dot beside a label: a glow for a settled state, a pulse for one in progress. */
export const dotStyles = cva("shrink-0 rounded-full", {
  variants: {
    tone: {
      neutral: "bg-zinc-400",
      positive: "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.2)]",
      warning: "bg-amber-500 animate-pulse",
      danger: "bg-rose-500 shadow-[0_0_0_3px_rgb(244_63_94/0.25)]",
      accent: "bg-amber-500",
    } satisfies Record<Tone, string>,
    size: {
      small: "size-1.5",
      regular: "size-2.5",
    },
  },
  defaultVariants: { size: "small" },
});
