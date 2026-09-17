import { For, Show, createMemo } from "solid-js";
import type { SiloSnapshot } from "@priemskiyyy/silo";
import { formatScope } from "src/formatting/formatScope";
import { formatWrites } from "src/formatting/formatWrites";
import type { RecordSelection } from "src/types/RecordSelection";

type RecordListProps = {
  storages: SiloSnapshot["storages"];
  records: SiloSnapshot["records"];
  selected: RecordSelection | null;
  onSelect: (record: RecordSelection | null) => void;
};

const isSelected = (
  selected: RecordSelection | null,
  record: SiloSnapshot["records"][number],
) =>
  selected !== null &&
  selected.storage === record.storage &&
  selected.physicalKey === record.physicalKey;

/** Every storage with the adapter that won, and under each the records the application reached. Listing them reads nothing. */
export const RecordList = (props: RecordListProps) => {
  const groups = createMemo(() =>
    props.storages.map((storage) => ({
      storage,
      records: props.records.filter(
        (record) => record.storage === storage.name,
      ),
    })),
  );

  return (
    <nav class="records" aria-label="Silo records">
      <button
        type="button"
        class="record"
        aria-pressed={props.selected === null}
        onClick={() => props.onSelect(null)}
      >
        <span class="record-name">All records</span>
        <span class="count">{props.records.length}</span>
      </button>
      <For each={groups()}>
        {({ storage, records }) => (
          <section
            class="group"
            aria-label={storage.name}
            data-floor={storage.adapter === "memory" ? "" : undefined}
          >
            <h3
              title={
                storage.namespace === ""
                  ? "No namespace"
                  : `Namespace ${storage.namespace}`
              }
            >
              {storage.name}
              <small>
                {storage.adapter} {storage.mode}
              </small>
            </h3>
            <For each={records}>
              {(record) => (
                <button
                  type="button"
                  class="record"
                  aria-pressed={isSelected(props.selected, record)}
                  onClick={() =>
                    props.onSelect({
                      storage: record.storage,
                      physicalKey: record.physicalKey,
                    })
                  }
                >
                  <span class="record-name">
                    <span class="dot" data-state={record.status.state} />
                    {record.path}
                  </span>
                  <small>
                    {formatScope(record.segments)} · {record.status.state} ·{" "}
                    {formatWrites(record.writes)}
                  </small>
                </button>
              )}
            </For>
            <Show when={records.length === 0}>
              <p class="record-empty">nothing reached</p>
            </Show>
          </section>
        )}
      </For>
    </nav>
  );
};
