const TAG = /#([\p{L}\p{N}_-]+)/gu;

/** Every `#word` in a text, once, lower-cased. */
export const extractTags = (text: string) =>
  new Set(
    [...text.matchAll(TAG)].map((match) => match[1]?.toLowerCase() ?? ""),
  );
