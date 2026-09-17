import { createContext } from "solid-js";
import type { Accessor } from "solid-js";
import type { RegisteredScope, RegisteredSilo } from "src/types/Register";

export const SiloContext = createContext<{
  silo: Accessor<RegisteredSilo>;
  scope: Accessor<RegisteredScope>;
}>();
