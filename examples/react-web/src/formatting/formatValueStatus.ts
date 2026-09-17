import type { ValueStatus } from "@priemskiyyy/silo";
import { match } from "ts-pattern";
import type { Tone } from "src/utils/Tone";

/** A value status as a badge: the label, the tone, and the phase that failed when one did. */
export const formatValueStatus = (status: ValueStatus) =>
  match(status)
    .returnType<{ label: string; tone: Tone }>()
    .with({ state: "hydrating" }, () => ({
      label: "Hydrating",
      tone: "warning",
    }))
    .with({ state: "ready" }, () => ({ label: "Ready", tone: "positive" }))
    .with({ state: "error" }, ({ error }) => ({
      label: `Error: ${error.phase}`,
      tone: "danger",
    }))
    .exhaustive();
