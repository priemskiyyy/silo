import { Show, createMemo } from "solid-js";
import type { Silo, SiloSnapshot } from "@priemskiyyy/silo";
import { PanelHeader } from "src/components/Panel/PanelHeader";
import { ResizeHandle } from "src/components/Panel/ResizeHandle";
import { RecordDetail } from "src/components/Records/RecordDetail";
import { RecordList } from "src/components/Records/RecordList";
import { Timeline } from "src/components/Timeline/Timeline";
import { useAutoFocus } from "src/hooks/useAutoFocus";
import { useEventFilters } from "src/hooks/useEventFilters";
import type { PanelPosition } from "src/types/PanelPosition";
import type { DevtoolsState } from "src/utils/devtoolsState";
import type { RecordedEvent } from "src/utils/EventLog";

type DevtoolsPanelProps = {
  silo: Silo;
  snapshot: SiloSnapshot;
  events: RecordedEvent[];
  recording: DevtoolsState["recording"];
  /** False when the panel opened from stored preferences, so mounting never steals focus. */
  autoFocus: boolean;
  position: PanelPosition;
  /** Height when docked to the bottom, width when docked to the right. */
  size: number;
  onSizeChange: (size: number) => void;
  onDock: () => void;
  onTogglePause: () => void;
  onShowValuesChange: (enabled: boolean) => void;
  onClear: () => void;
  onClose: () => void;
};

export const DevtoolsPanel = (props: DevtoolsPanelProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);
  const filters = useEventFilters(() => props.events);
  // The selection names a record; the snapshot says whether it still exists.
  const selectedRecord = createMemo(() => {
    const selected = filters.filters().record;

    if (selected === null) {
      return null;
    }

    return (
      props.snapshot.records.find(
        (record) =>
          record.storage === selected.storage &&
          record.physicalKey === selected.physicalKey,
      ) ?? null
    );
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    event.stopPropagation();
    props.onClose();
  };

  return (
    <aside
      ref={focusOnMount}
      tabIndex={-1}
      class="panel"
      data-position={props.position}
      aria-label="Silo devtools"
      style={
        props.position === "bottom"
          ? { height: `${props.size}px` }
          : { width: `${props.size}px` }
      }
      onKeyDown={handleKeyDown}
    >
      <ResizeHandle
        position={props.position}
        size={props.size}
        onSizeChange={(size) => props.onSizeChange(size)}
      />
      <PanelHeader
        snapshot={props.snapshot}
        position={props.position}
        onDock={() => props.onDock()}
        onClose={() => props.onClose()}
      />
      <div class="body">
        <RecordList
          storages={props.snapshot.storages}
          records={props.snapshot.records}
          selected={filters.filters().record}
          onSelect={(record) => filters.update({ record })}
        />
        <div class="main">
          <Show when={selectedRecord()}>
            {(record) => (
              <RecordDetail
                silo={props.silo}
                record={record()}
                showValues={props.recording.showValues}
                onClose={() => filters.update({ record: null })}
              />
            )}
          </Show>
          <Timeline
            events={props.events}
            recording={props.recording}
            filters={filters}
            onTogglePause={() => props.onTogglePause()}
            onShowValuesChange={(enabled) => props.onShowValuesChange(enabled)}
            onClear={() => props.onClear()}
          >
            <Timeline.Toolbar />
            <Timeline.Kinds />
            <Timeline.Rows emptyState={<Timeline.Empty />} />
          </Timeline>
        </div>
      </div>
    </aside>
  );
};
