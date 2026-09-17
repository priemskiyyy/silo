import type { ComputedRef, InjectionKey } from "vue";
import type { RegisteredScope, RegisteredSilo } from "src/types/Register";

export const SILO_CONTEXT: InjectionKey<
  ComputedRef<{
    silo: RegisteredSilo;
    scope: RegisteredScope;
  }>
> = Symbol("silo");
