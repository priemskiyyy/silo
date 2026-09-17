import { formatErrorSummary } from "src/formatting/formatErrorSummary";

const field = (context: object, key: string): unknown =>
  key in context ? Reflect.get(context, key) : undefined;

/** One-line row text from the fields silo's contexts carry. `value` is the inspected copy. */
export const formatContextSummary = (value: unknown) => {
  if (typeof value !== "object" || value === null) {
    return value === undefined || value === null ? "" : String(value);
  }

  const parts: string[] = [];
  const outcome = field(value, "outcome");
  const kind = field(value, "kind");
  const version = field(value, "version");
  const generation = field(value, "generation");
  const reason = field(value, "reason");
  const path = field(value, "path");
  const cause = field(value, "cause");

  if (typeof path === "string") {
    parts.push(path);
  }

  if (typeof outcome === "string") {
    parts.push(outcome);
  }

  if (typeof kind === "string") {
    parts.push(kind);
  }

  if (typeof version === "number") {
    parts.push(`v${version}`);
  }

  if (typeof generation === "number") {
    parts.push(`#${generation}`);
  }

  if (typeof reason === "string") {
    parts.push(reason);
  }

  if (cause !== undefined) {
    parts.push(formatErrorSummary(cause));
  }

  return parts.join(" · ");
};
