import type { SiloSnapshot } from "@priemskiyyy/silo";
import { SiloIcon } from "src/components/SiloIcon";
import { formatVersion } from "src/formatting/formatVersion";
import type { PanelPosition } from "src/types/PanelPosition";

type PanelHeaderProps = {
  snapshot: SiloSnapshot;
  position: PanelPosition;
  onDock: () => void;
  onClose: () => void;
};

export const PanelHeader = (props: PanelHeaderProps) => (
  <header class="header">
    <SiloIcon />
    <strong>Silo</strong>
    <span class="status" data-state={props.snapshot.status.state}>
      <span class="dot" data-state={props.snapshot.status.state} />
      {props.snapshot.status.state}
    </span>
    <code class="version" title="Migration version">
      {formatVersion(props.snapshot.version)}
    </code>
    <button
      type="button"
      class="icon-button"
      aria-label={
        props.position === "bottom" ? "Dock to the right" : "Dock to the bottom"
      }
      onClick={() => props.onDock()}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect
          x="1.5"
          y="1.5"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
        />
        {props.position === "bottom" ? (
          <rect
            x="8"
            y="1.5"
            width="4.5"
            height="11"
            rx="1"
            fill="currentColor"
          />
        ) : (
          <rect
            x="1.5"
            y="8"
            width="11"
            height="4.5"
            rx="1"
            fill="currentColor"
          />
        )}
      </svg>
    </button>
    <button
      type="button"
      class="icon-button"
      aria-label="Close devtools"
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
);
