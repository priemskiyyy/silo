export const SECTIONS = {
  notebook: { number: 1, title: "Your notebook", label: "Notebook" },
  place: { number: 2, title: "Compare storage", label: "Storages" },
  lab: { number: 3, title: "Test recovery", label: "Recovery" },
  inside: { number: 4, title: "Inspect your data", label: "Inspect" },
};

export type SectionId = keyof typeof SECTIONS;
