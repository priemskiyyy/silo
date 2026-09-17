import { createContext } from "react";
import type { RegisteredScope, RegisteredSilo } from "src/types/Register";

export type SiloContextValue = {
  silo: RegisteredSilo;
  /** What the value hooks read under: the provider's scope, or the store itself. */
  scope: RegisteredScope;
};

export const SiloContext = createContext<SiloContextValue | undefined>(
  undefined,
);
