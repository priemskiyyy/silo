import type React from "react";
import { NotePencil, Plus } from "@phosphor-icons/react";
import { useValue } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { match } from "ts-pattern";
import { SaveBadge } from "src/components/Badge/SaveBadge";
import { StatusPill } from "src/components/Badge/StatusPill";
import { EmptyState } from "src/components/EmptyState/EmptyState";
import { EntryRow } from "src/components/Entries/EntryRow";
import { Panel } from "src/components/Panel/Panel";
import { Skeleton } from "src/components/Skeleton/Skeleton";
import { useDurableValue } from "src/hooks/useDurableValue";
import { useNow } from "src/hooks/useNow";
import { useRootValue } from "src/hooks/useRootValue";
import type { Entry } from "src/silo/Entry";
import { FILTERS, SORTS } from "src/silo/createFieldbookSilo";
import type { Filter, Sort } from "src/silo/createFieldbookSilo";
import { buttonStyles } from "src/styles/buttonStyles";
import { FIELD_CLASS_NAME } from "src/styles/fieldStyles";
import { createEntry } from "src/utils/createEntry";
import type { Place } from "src/utils/describeStorages";

type EntriesPanelProps = {
  livesIn: Place[];
};

const DAY = 86_400_000;

const matchesFilter = (entry: Entry, filter: Filter, now: number) =>
  match(filter)
    .with("all", () => true)
    .with("today", () => now - entry.createdAt.getTime() < DAY)
    .with("starred", () => entry.starred)
    .exhaustive();

const compareBy = (sort: Sort) =>
  match(sort)
    .with(
      "newest",
      () => (left: Entry, right: Entry) =>
        right.createdAt.getTime() - left.createdAt.getTime(),
    )
    .with(
      "oldest",
      () => (left: Entry, right: Entry) =>
        left.createdAt.getTime() - right.createdAt.getTime(),
    )
    .exhaustive();

type EntriesListProps = {
  entries: Entry[];
  visible: Entry[];
  hydrating: boolean;
  changedOutside: boolean;
  now: number;
  selectedEntry: string | undefined;
  onSelect: (entry: Entry) => void;
  onStarToggle: (entry: Entry) => void;
  onRemove: (entry: Entry) => void;
};

const EntriesList: React.FunctionComponent<EntriesListProps> = ({
  entries,
  visible,
  hydrating,
  changedOutside,
  now,
  selectedEntry,
  onSelect,
  onStarToggle,
  onRemove,
}) => {
  if (hydrating) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton variant="field" />
        <Skeleton variant="field" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={NotePencil}
        title="No entries yet"
        description="Add one above, or write a longer one in the Composer."
      />
    );
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={NotePencil}
        title="Nothing matches"
        description="The filter, the sort and the search are in the URL. Share the link and they come along."
      />
    );
  }

  return (
    <ol
      data-changed-outside={changedOutside}
      className="flex flex-col gap-(--row-gap) rounded-xl"
    >
      {visible.map((entry) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          now={now}
          selected={selectedEntry === entry.id}
          onSelect={() => onSelect(entry)}
          onStarToggle={() => onStarToggle(entry)}
          onRemove={() => onRemove(entry)}
        />
      ))}
    </ol>
  );
};

/**
 * Entries live in IndexedDB under the notebook scope, so a `Date` and a `Set`
 * come back as themselves. Filter, sort and query are URL keys read at the
 * root: change one and the address bar changes with it.
 */
export const EntriesPanel: React.FunctionComponent<EntriesPanelProps> = ({
  livesIn,
}) => {
  const now = useNow(15_000);
  const {
    value: entries,
    status,
    save,
    persist,
    changedOutside,
  } = useDurableValue("journal.entries");
  const [selectedEntry, setSelectedEntry] = useValue("session.selectedEntry");
  const [filter, setFilter] = useRootValue("url.filter");
  const [sort, setSort] = useRootValue("url.sort");
  const [query, setQuery] = useRootValue("url.query");
  const [draftTitle, setDraftTitle] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = entries
    .filter((entry) => matchesFilter(entry, filter, now))
    .filter(
      (entry) =>
        needle === "" ||
        `${entry.title} ${entry.body}`.toLowerCase().includes(needle),
    )
    .sort(compareBy(sort));

  const handleAddSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (draftTitle.trim() === "") {
      return;
    }

    persist([createEntry(draftTitle), ...entries]);
    setDraftTitle("");
  };
  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(
      FILTERS.find((candidate) => candidate === event.target.value) ?? "all",
    );
  };
  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(
      SORTS.find((candidate) => candidate === event.target.value) ?? "newest",
    );
  };
  const handleSelect = (entry: Entry) => {
    setSelectedEntry(selectedEntry === entry.id ? undefined : entry.id);
  };
  const handleStarToggle = (entry: Entry) => {
    persist(
      entries.map((candidate) =>
        candidate.id === entry.id
          ? { ...candidate, starred: !candidate.starred }
          : candidate,
      ),
    );
  };
  const handleRemove = (entry: Entry) => {
    persist(entries.filter((candidate) => candidate.id !== entry.id));
  };

  return (
    <Panel
      title="Entries"
      icon={NotePencil}
      shows="A list in IndexedDB under the notebook scope, a Date and a Set per entry, filtered by keys that live in the URL."
      livesIn={livesIn}
      aside={
        <>
          <SaveBadge save={save} />
          <StatusPill status={status} />
        </>
      }
    >
      <form
        onSubmit={handleAddSubmit}
        className="flex flex-wrap gap-2"
        aria-label="Add entry"
      >
        <input
          aria-label="New entry"
          placeholder="Reached the ridge #camp"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          className={`${FIELD_CLASS_NAME} min-w-0 flex-1`}
        />
        <button type="submit" className={buttonStyles({ variant: "primary" })}>
          <Plus size={14} weight="bold" />
          Add entry
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm">
          Filter
          <select
            aria-label="Filter"
            value={filter}
            onChange={handleFilterChange}
            className={FIELD_CLASS_NAME}
          >
            {FILTERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Sort
          <select
            aria-label="Sort"
            value={sort}
            onChange={handleSortChange}
            className={FIELD_CLASS_NAME}
          >
            {SORTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          aria-label="Search entries"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${FIELD_CLASS_NAME} min-w-40 flex-1`}
        />
      </div>
      <EntriesList
        entries={entries}
        visible={visible}
        hydrating={status.state === "hydrating"}
        changedOutside={changedOutside}
        now={now}
        selectedEntry={selectedEntry}
        onSelect={handleSelect}
        onStarToggle={handleStarToggle}
        onRemove={handleRemove}
      />
    </Panel>
  );
};
