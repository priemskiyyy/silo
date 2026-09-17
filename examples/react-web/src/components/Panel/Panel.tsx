import type React from "react";
import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Badge } from "src/components/Badge/Badge";
import { IconTile } from "src/components/IconTile/IconTile";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";
import type { Place } from "src/utils/describeStorages";

type PanelProps = {
  title: string;
  icon: Icon;
  /** One line saying which silo fact this panel exists to show. */
  shows: string;
  /** Where the panel's values live: storage, adapter and mode, one chip each, inline after the line. */
  livesIn?: Place[];
  /** Right-aligned header content, such as a status pill. */
  aside?: ReactNode;
  children: ReactNode;
};

export const Panel: React.FunctionComponent<PanelProps> = ({
  title,
  icon,
  shows,
  livesIn = [],
  aside,
  children,
}) => (
  <section
    aria-label={title}
    className={`flex h-full flex-col gap-3 p-(--panel-padding) ${CARD_CLASS_NAME}`}
  >
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <IconTile icon={icon} size="small" />
        <h3 className="text-sm font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-300">
          {title}
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span>{shows}</span>
        {livesIn.map((place) => (
          <Badge
            key={place.storage}
            tone={place.adapter === "memory" ? "accent" : "neutral"}
          >
            <span className="font-mono">{place.storage}</span>
            <span aria-hidden="true">·</span>
            <span>{place.adapter}</span>
            <span className="opacity-60">{place.mode}</span>
          </Badge>
        ))}
      </p>
    </header>
    {children}
  </section>
);
