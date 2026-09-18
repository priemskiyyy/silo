import { z } from "zod";

export const EntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.date(),
  tags: z.set(z.string()),
  starred: z.boolean(),
});

export type Entry = z.infer<typeof EntrySchema>;
