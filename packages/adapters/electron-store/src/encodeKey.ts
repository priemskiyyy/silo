/**
 * electron-store reads a `.` in a key as a path into nested objects, and a
 * silo scope segment may carry one, so every key reaches the store percent
 * encoded, with the dot encoded too because `encodeURIComponent` leaves it
 * alone. `decodeURIComponent` reverses both.
 *
 * @example
 * ```ts
 * encodeKey("silo:v1.2:theme"); // "silo%3Av1%2E2%3Atheme"
 * ```
 */
export const encodeKey = (key: string) =>
  encodeURIComponent(key).replaceAll(".", "%2E");
