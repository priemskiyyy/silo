import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import type { Accessor } from "solid-js";
import type { Silo } from "@priemskiyyy/silo";
import { Launcher } from "src/components/Launcher";
import { DevtoolsPanel } from "src/components/Panel/DevtoolsPanel";
import { useObservableValue } from "src/hooks/useObservableValue";
import { useStoredValue } from "src/hooks/useStoredValue";
import { styles } from "src/styles";
import type { PanelPosition } from "src/types/PanelPosition";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { devtoolsReducer, initialDevtoolsState } from "src/utils/devtoolsState";
import type { DevtoolsAction } from "src/utils/devtoolsState";
import type { EventLog } from "src/utils/EventLog";
import { parsePreferences } from "src/utils/parsePreferences";

const DEFAULT_SIZE = { bottom: 420, right: 520 } satisfies Record<
  PanelPosition,
  number
>;
const PREFERENCES_KEY = "@priemskiyyy/silo-devtools";

export type DevtoolsProps = {
  silo: Accessor<Silo>;
  maxEvents: Accessor<number>;
  initialIsOpen: boolean;
  log: EventLog;
};

/** The shadow-root application: records while mounted and renders the launcher or the panel. */
export const Devtools = (props: DevtoolsProps) => {
  const [preferences, setPreferences] = useStoredValue(
    PREFERENCES_KEY,
    parsePreferences,
    {},
  );
  const [state, setState] = createSignal(
    initialDevtoolsState(preferences().isOpen ?? props.initialIsOpen),
  );
  const snapshot = useObservableValue(() => props.silo().diagnostics);
  const events = useObservableValue(() => props.log);
  const panel = createMemo(() => state().panel);
  const recording = createMemo(() => state().recording);
  const isPaused = createMemo(() => recording().isPaused);
  const position = createMemo(() => preferences().position ?? "bottom");
  const size = createMemo(() => {
    const { height, width } = preferences();

    return position() === "bottom"
      ? (height ?? DEFAULT_SIZE.bottom)
      : (width ?? DEFAULT_SIZE.right);
  });
  const hasUnseenError = createMemo(() => {
    const current = panel();

    if (current.status !== "CLOSED") {
      return false;
    }

    return events().some(
      (event) => event.kind === "ERROR" && event.timestamp > current.closedAt,
    );
  });

  const dispatch = (action: DevtoolsAction) => {
    setState((current) => devtoolsReducer(current, action));
  };
  const handleSizeChange = (next: number) => {
    const key = position() === "bottom" ? "height" : "width";
    setPreferences({ ...preferences(), [key]: next });
  };
  const handleDock = () => {
    const next: PanelPosition = position() === "bottom" ? "right" : "bottom";
    setPreferences({ ...preferences(), position: next });
  };

  createEffect(() => {
    props.log.setLimit(props.maxEvents());
  });

  createEffect(() => {
    if (isPaused()) {
      return;
    }

    const { diagnostics } = props.silo();
    onCleanup(
      diagnostics.events.subscribe((event) =>
        props.log.add(event, recording().showValues),
      ),
    );
  });

  // Only the panel state is tracked here; reading the preferences would re-run this on its own write.
  createEffect(() => {
    const isOpen = panel().status === "OPEN";
    setPreferences({ ...untrack(preferences), isOpen });
  });

  return (
    <div class="root" data-silo-devtools="">
      <style>{styles}</style>
      {(() => {
        const current = panel();

        if (current.status === "OPEN") {
          return (
            <DevtoolsPanel
              silo={props.silo()}
              snapshot={snapshot()}
              events={events()}
              recording={recording()}
              autoFocus={current.focusPanel}
              position={position()}
              size={size()}
              onSizeChange={handleSizeChange}
              onDock={handleDock}
              onTogglePause={() => dispatch({ type: "TOGGLE_PAUSE" })}
              onShowValuesChange={(enabled) =>
                dispatch({ type: "SET_SHOW_VALUES", enabled })
              }
              onClear={props.log.clear}
              onClose={() => dispatch({ type: "CLOSE", at: Date.now() })}
            />
          );
        }

        if (current.status === "CLOSED") {
          return (
            <Launcher
              status={snapshot().status}
              hasUnseenError={hasUnseenError()}
              autoFocus={current.focusLauncher}
              onOpen={() => dispatch({ type: "OPEN" })}
            />
          );
        }

        return assertUnreachable(current);
      })()}
    </div>
  );
};
