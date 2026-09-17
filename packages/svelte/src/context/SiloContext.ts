import type { ReadableValue } from "../types/ReadableValue.js";
import type { RegisteredSilo, RegisteredScope } from "../types/Register.js";

export type SiloContextValue = {
  silo: ReadableValue<RegisteredSilo>;
  scope: ReadableValue<RegisteredScope>;
};

export const SILO_CONTEXT = Symbol("silo");
