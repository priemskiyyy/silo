import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Keeps links readable, for example `?note=hello`. Numeric schemas coerce
 * the incoming text; this format only handles serialization.
 */
export const plainTextFormat: TextFormat = {
  stringify: (value) => (value === undefined ? undefined : String(value)),
  parse: (text) => text,
};
