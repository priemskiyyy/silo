/** The four steps of the tour, top to bottom; the nav, the section headers and the scroll spy read the same list. */
export const SECTIONS = {
  place: { number: 1, title: "Pick a place" },
  notebook: { number: 2, title: "A real notebook on top" },
  lab: { number: 3, title: "Break things" },
  inside: { number: 4, title: "Look inside" },
} as const;

export type SectionId = keyof typeof SECTIONS;
