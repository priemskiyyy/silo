// Typechecked, never imported: the real Workers binding must fit the
// structural type with no cast, or the type has drifted from the runtime.
import type { DurableObjectStorage } from "@cloudflare/workers-types";
import type { DurableStorage } from "src/types/DurableStorage";

declare const objectStorage: DurableObjectStorage;

export const durable: DurableStorage = objectStorage;
