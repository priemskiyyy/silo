import type { Entry } from "src/silo/Entry";
import { extractTags } from "src/utils/extractTags";

/** The first line is the title, the rest is the body, and `#tags` come from both. */
export const createEntry = (text: string): Entry => {
  const [firstLine = "", ...rest] = text.trim().split("\n");

  return {
    id: crypto.randomUUID(),
    title: firstLine.trim(),
    body: rest.join("\n").trim(),
    createdAt: new Date(),
    tags: extractTags(text),
    starred: false,
  };
};
