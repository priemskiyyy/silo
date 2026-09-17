import { createSignal } from "solid-js";
import type {
  Silo,
  SiloScope,
  SiloSnapshot,
  Storages,
} from "@priemskiyyy/silo";
import { CopyButton } from "src/components/Timeline/CopyButton";
import { formatContextText } from "src/formatting/formatContextText";
import { formatScope } from "src/formatting/formatScope";
import { inspectContext } from "src/utils/inspectContext";

type RecordDetailProps = {
  silo: Silo;
  record: SiloSnapshot["records"][number];
  /** Off by default: a secure storage's value must not show on a shared screen by accident. */
  showValues: boolean;
  onClose: () => void;
};

// The one place the devtools reach a value, and only one that already
// exists: the record came from the snapshot, so nothing new hydrates.
const reach = (silo: Silo, record: SiloSnapshot["records"][number]) => {
  const root: SiloScope<Storages> = silo;
  const scope = record.segments.reduce(
    (parent, segment) => parent.scope(segment),
    root,
  );

  return scope.value(record.path);
};

/** The selected record: its identity, its snapshot, and the two actions a developer needs. */
export const RecordDetail = (props: RecordDetailProps) => {
  const [draft, setDraft] = createSignal("");
  const [failure, setFailure] = createSignal<string | null>(null);
  const snapshot = () =>
    props.showValues
      ? formatContextText(inspectContext(props.record.value, true))
      : '[Values are hidden] Tick "Show values" to see the snapshot.';

  const handleSetClick = () => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(draft());
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Invalid JSON");
      return;
    }

    setFailure(null);
    reach(props.silo, props.record).set(parsed);
  };
  const handleRemoveClick = () => {
    setFailure(null);
    reach(props.silo, props.record).remove();
  };

  return (
    <section class="detail" aria-label="Selected record">
      <header class="detail-header">
        <code class="detail-key" title="Physical key">
          {props.record.physicalKey}
        </code>
        <span class="status" data-state={props.record.status.state}>
          <span class="dot" data-state={props.record.status.state} />
          {props.record.status.state}
        </span>
        <small class="muted">
          {props.record.storage} · {formatScope(props.record.segments)} ·{" "}
          {props.record.path}
        </small>
        <button
          type="button"
          class="icon-button detail-close"
          aria-label="Deselect record"
          onClick={() => props.onClose()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </header>
      <div class="detail-body">
        <div class="context" aria-label="Snapshot">
          <pre>{snapshot()}</pre>
          <CopyButton text={snapshot()} />
        </div>
        <form
          class="detail-actions"
          onSubmit={(event) => {
            event.preventDefault();
            handleSetClick();
          }}
        >
          <textarea
            aria-label="New value as JSON"
            placeholder={'JSON, such as "dark" or { "count": 3 }'}
            rows={3}
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
          />
          <div class="detail-buttons">
            <button type="submit">Set</button>
            <button type="button" onClick={handleRemoveClick}>
              Remove
            </button>
            {failure() === null ? null : (
              <span class="error" role="alert">
                {failure()}
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
};
