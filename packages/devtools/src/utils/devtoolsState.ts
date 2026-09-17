import { assertUnreachable } from "src/utils/assertUnreachable";

export type DevtoolsState = {
  panel:
    | { status: "OPEN"; focusPanel: boolean }
    | { status: "CLOSED"; focusLauncher: boolean; closedAt: number };
  recording: { isPaused: boolean; showValues: boolean };
};

export type DevtoolsAction =
  | { type: "OPEN" }
  | { type: "CLOSE"; at: number }
  | { type: "TOGGLE_PAUSE" }
  | { type: "SET_SHOW_VALUES"; enabled: boolean };

/** Focus only moves after the user opens or closes the panel, never on mount. */
export const initialDevtoolsState = (
  initialIsOpen: boolean,
): DevtoolsState => ({
  panel: initialIsOpen
    ? { status: "OPEN", focusPanel: false }
    : { status: "CLOSED", focusLauncher: false, closedAt: 0 },
  recording: { isPaused: false, showValues: false },
});

export const devtoolsReducer = (
  state: DevtoolsState,
  action: DevtoolsAction,
): DevtoolsState => {
  if (action.type === "OPEN") {
    return { ...state, panel: { status: "OPEN", focusPanel: true } };
  }

  if (action.type === "CLOSE") {
    return {
      ...state,
      panel: { status: "CLOSED", focusLauncher: true, closedAt: action.at },
    };
  }

  if (action.type === "TOGGLE_PAUSE") {
    return {
      ...state,
      recording: { ...state.recording, isPaused: !state.recording.isPaused },
    };
  }

  if (action.type === "SET_SHOW_VALUES") {
    return {
      ...state,
      recording: { ...state.recording, showValues: action.enabled },
    };
  }

  return assertUnreachable(action);
};
