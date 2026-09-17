import { useTimeline } from "src/components/Timeline/useTimeline";

/** Search, pause, clear, and the value visibility switch. */
export const TimelineToolbar = () => {
  const timeline = useTimeline();

  return (
    <div class="toolbar">
      <input
        aria-label="Filter events"
        type="search"
        placeholder="Filter by type, storage, key, or detail…"
        value={timeline.filters.filters().query}
        onInput={(event) =>
          timeline.filters.update({ query: event.currentTarget.value })
        }
      />
      <button
        type="button"
        aria-pressed={timeline.recording().isPaused}
        onClick={() => timeline.onTogglePause()}
      >
        {timeline.recording().isPaused ? "Resume" : "Pause"}
      </button>
      <button type="button" onClick={() => timeline.onClear()}>
        Clear
      </button>
      <label class="capture">
        <input
          type="checkbox"
          checked={timeline.recording().showValues}
          onChange={(event) =>
            timeline.onShowValuesChange(event.currentTarget.checked)
          }
        />
        Show values
      </label>
      <span class="total">
        {timeline.filters.visibleEvents().length} / {timeline.events().length}
      </span>
    </div>
  );
};
