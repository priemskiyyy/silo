/** The scope a record lives under, or `root` for the store itself. */
export const formatScope = (segments: string[]) =>
  segments.length === 0 ? "root" : segments.join(":");
