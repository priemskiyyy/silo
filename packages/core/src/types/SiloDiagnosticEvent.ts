/**
 * One thing that happened inside a store. `value` events carry the storage
 * and physical key of the record they belong to; `migration` and `store`
 * events carry neither. `type` is a short phrase such as `write accepted`,
 * `hydrate landed`, `outside dropped` or `migration step`; `context` is the
 * detail, never an SDK object.
 *
 * @example
 * ```ts
 * silo.diagnostics.events.subscribe((event) => console.debug(event.type, event.key, event.context));
 * ```
 */
export type SiloDiagnosticEvent = {
  source: "value" | "migration" | "store";
  type: string;
  storage: string | null;
  key: string | null;
  timestamp: number;
  context: unknown;
};
