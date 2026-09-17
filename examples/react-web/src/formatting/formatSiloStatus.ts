import type { SiloStatus } from "@priemskiyyy/silo";
import { match } from "ts-pattern";
import type { Tone } from "src/utils/Tone";

/** The store's status as a badge: a label and the tone that carries it. */
export const formatSiloStatus = (status: SiloStatus) =>
  match(status)
    .returnType<{ label: string; tone: Tone }>()
    .with({ state: "migrating" }, () => ({
      label: "Migrating",
      tone: "warning",
    }))
    .with({ state: "ready" }, () => ({
      label: "Store ready",
      tone: "positive",
    }))
    .with({ state: "error" }, ({ error }) => ({
      label: `Migration failed: ${String(error.cause)}`,
      tone: "danger",
    }))
    .exhaustive();
