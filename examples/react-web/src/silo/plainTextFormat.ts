import type { TextFormat } from "@priemskiyyy/silo";

/**
 * Values in the address bar as people type them: `?note=hello` rather than
 * `?note=%22hello%22`. Every value comes back as text, so a key that is not
 * a string carries its own codec, the way `count` does.
 */
export const plainTextFormat: TextFormat = {
  stringify: (value) => (value === undefined ? undefined : String(value)),
  parse: (text) => text,
};
