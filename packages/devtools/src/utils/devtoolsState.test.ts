import { expect, test } from "vitest";
import { devtoolsReducer, initialDevtoolsState } from "src/utils/devtoolsState";

test("the initial state opens only when asked and never moves focus on mount", () => {
  expect(initialDevtoolsState(true).panel).toEqual({
    status: "OPEN",
    focusPanel: false,
  });
  expect(initialDevtoolsState(false)).toEqual({
    panel: { status: "CLOSED", focusLauncher: false, closedAt: 0 },
    recording: { isPaused: false, showValues: false },
  });
});

test("opening and closing move focus and remember when the panel closed", () => {
  const closed = devtoolsReducer(initialDevtoolsState(true), {
    type: "CLOSE",
    at: 42,
  });
  expect(closed.panel).toEqual({
    status: "CLOSED",
    focusLauncher: true,
    closedAt: 42,
  });
  expect(devtoolsReducer(closed, { type: "OPEN" }).panel).toEqual({
    status: "OPEN",
    focusPanel: true,
  });
});

test("recording toggles pause and value visibility independently", () => {
  const paused = devtoolsReducer(initialDevtoolsState(false), {
    type: "TOGGLE_PAUSE",
  });
  expect(paused.recording).toEqual({ isPaused: true, showValues: false });
  expect(
    devtoolsReducer(paused, { type: "SET_SHOW_VALUES", enabled: true })
      .recording,
  ).toEqual({ isPaused: true, showValues: true });
  expect(
    devtoolsReducer(paused, { type: "TOGGLE_PAUSE" }).recording.isPaused,
  ).toBe(false);
});
