// Typechecked, never imported: the real Workers binding must fit the
// structural type with no cast, or the type has drifted from the runtime.
import type { KVNamespace } from "@cloudflare/workers-types";
import type { KvNamespace } from "src/types/KvNamespace";

declare const namespace: KVNamespace;

export const kv: KvNamespace = namespace;
