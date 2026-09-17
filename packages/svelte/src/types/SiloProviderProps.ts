import type { Snippet } from "svelte";
import type { RegisteredSilo } from "./Register.js";

/** Provider inputs. @example `const props = { silo, scope: "account" } satisfies SiloProviderProps;` */
export type SiloProviderProps = {
  silo: RegisteredSilo;
  scope?: string | undefined;
  children?: Snippet;
};
