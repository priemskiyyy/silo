/** One journal entry, stored as a structured clone: the `Date` and the `Set` survive because the journal lives in IndexedDB. */
export type Entry = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  tags: Set<string>;
  starred: boolean;
};
