import type React from "react";
import {
  ClockCounterClockwise,
  Database,
  MagnifyingGlass,
  Rows,
} from "@phosphor-icons/react";
import { Badge } from "src/components/Badge/Badge";
import { Panel } from "src/components/Panel/Panel";

/** What the launcher in the corner opens, so the reader knows to look for it and what to look at. */
export const DevtoolsCard: React.FunctionComponent = () => (
  <Panel
    title="Devtools"
    icon={MagnifyingGlass}
    shows="The launcher in the bottom-right corner opens an inspector that reads the store's diagnostics only, so opening it never hydrates a value. Escape closes it; it docks to any edge and remembers its size."
  >
    <ul className="flex flex-wrap gap-2">
      <li title="Each of the eight with the adapter that won its list, its mode and its namespace.">
        <Badge tone="neutral" icon={Database}>
          Storages
        </Badge>
      </li>
      <li title="Every key the page reached, its status, its value and how many writes were accepted and made durable.">
        <Badge tone="neutral" icon={Rows}>
          Records
        </Badge>
      </li>
      <li title="Hydrates, writes, outside changes and migrations, filterable by kind.">
        <Badge tone="neutral" icon={ClockCounterClockwise}>
          Timeline
        </Badge>
      </li>
    </ul>
  </Panel>
);
