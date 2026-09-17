import type { PlaygroundStorage } from "src/silo/playground";
import { assertUnreachable } from "src/utils/assertUnreachable";

export const NOTEBOOK_IDS = ["alpine", "coast", "desert"] as const;

export type NotebookId = (typeof NOTEBOOK_IDS)[number];

/** What the Lab bar changes about the store. A change recreates the store, the way a new source recreates a realtime client. */
export type LabFlags = { privateMode: boolean; slowJournal: boolean };

export type ApplicationState = {
  /** Everything a store is built from: a new object here is a new store. */
  store: {
    flags: LabFlags;
    /** Bumped when the Lab asks for a fresh store over the same flags. */
    generation: number;
  };
  notebookId: NotebookId;
  /** Where the Playground keeps its note. */
  playgroundStorage: PlaygroundStorage;
};

export type ApplicationAction =
  | { type: "PRIVATE_MODE_TOGGLED" }
  | { type: "SLOW_JOURNAL_TOGGLED" }
  | { type: "NOTEBOOK_SELECTED"; notebookId: NotebookId }
  | { type: "PLAYGROUND_STORAGE_SELECTED"; storage: PlaygroundStorage }
  | { type: "STORE_RECREATED" };

export const initialApplicationState: ApplicationState = {
  store: { flags: { privateMode: false, slowJournal: false }, generation: 0 },
  notebookId: "alpine",
  playgroundStorage: "default",
};

export const applicationReducer = (
  state: ApplicationState,
  action: ApplicationAction,
): ApplicationState => {
  const { store } = state;

  if (action.type === "PRIVATE_MODE_TOGGLED") {
    return {
      ...state,
      store: {
        ...store,
        flags: { ...store.flags, privateMode: !store.flags.privateMode },
      },
    };
  }

  if (action.type === "SLOW_JOURNAL_TOGGLED") {
    return {
      ...state,
      store: {
        ...store,
        flags: { ...store.flags, slowJournal: !store.flags.slowJournal },
      },
    };
  }

  if (action.type === "NOTEBOOK_SELECTED") {
    return { ...state, notebookId: action.notebookId };
  }

  if (action.type === "PLAYGROUND_STORAGE_SELECTED") {
    return { ...state, playgroundStorage: action.storage };
  }

  if (action.type === "STORE_RECREATED") {
    return {
      ...state,
      store: { ...store, generation: store.generation + 1 },
    };
  }

  return assertUnreachable(action);
};
