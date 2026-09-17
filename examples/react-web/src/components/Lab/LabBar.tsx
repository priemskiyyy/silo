import type React from "react";
import {
  ArrowClockwise,
  Bug,
  Flask,
  LockKey,
  Sparkle,
  Timer,
  Wrench,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useState } from "react";
import type { LabFlags } from "src/state/applicationReducer";
import { buttonStyles } from "src/styles/buttonStyles";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";

type LabBarProps = {
  flags: LabFlags;
  onPrivateModeToggle: () => void;
  onSlowJournalToggle: () => void;
  onFailNextWritePress: () => void;
  onCorruptThemePress: () => void;
  onPlantLegacyDataPress: () => void;
  onRecreatePress: () => void;
};

type ControlProps = {
  icon: Icon;
  label: string;
  description: string;
  /** A toggle reports its state; a one-shot control has none. */
  pressed?: boolean;
  onPress: () => void;
  /** The shared hint line shows the hovered or focused control's description. */
  onHint: (description: string | null) => void;
};

const IDLE_HINT = "Hover or focus a control to read what it does.";

const Control: React.FunctionComponent<ControlProps> = ({
  icon: ControlIcon,
  label,
  description,
  pressed,
  onPress,
  onHint,
}) => (
  <li>
    <button
      type="button"
      title={description}
      onClick={onPress}
      onMouseEnter={() => onHint(description)}
      onMouseLeave={() => onHint(null)}
      onFocus={() => onHint(description)}
      onBlur={() => onHint(null)}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className={buttonStyles({ pressed: pressed === true, size: "small" })}
    >
      <ControlIcon size={12} weight="bold" />
      {label}
    </button>
  </li>
);

/** Breaks things on purpose. Every control here exists to make one core guarantee visible. */
export const LabBar: React.FunctionComponent<LabBarProps> = ({
  flags,
  onPrivateModeToggle,
  onSlowJournalToggle,
  onFailNextWritePress,
  onCorruptThemePress,
  onPlantLegacyDataPress,
  onRecreatePress,
}) => {
  const [hint, setHint] = useState<string | null>(null);

  return (
    <section
      aria-label="Lab"
      className={`flex h-full flex-col gap-3 border-dashed p-(--panel-padding) ${CARD_CLASS_NAME}`}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-300">
        <Flask
          size={16}
          weight="duotone"
          className="text-amber-600 dark:text-amber-400"
        />
        Lab
      </h3>
      <ul className="flex flex-wrap gap-2">
        <Control
          icon={LockKey}
          label="Private mode"
          description="localStorage becomes unavailable. The store is rebuilt and Local falls through to memory."
          pressed={flags.privateMode}
          onPress={onPrivateModeToggle}
          onHint={setHint}
        />
        <Control
          icon={Timer}
          label="Slow journal"
          description="Every IndexedDB operation takes 900ms, so hydrating and writing stay on screen."
          pressed={flags.slowJournal}
          onPress={onSlowJournalToggle}
          onHint={setHint}
        />
        <Control
          icon={Bug}
          label="Fail next write"
          description="The journal refuses its next write. The Composer shows the refusal, and Retry writes the same value again."
          onPress={onFailNextWritePress}
          onHint={setHint}
        />
        <Control
          icon={Sparkle}
          label="Corrupt theme"
          description="Writes text that is not JSON under the theme key and rebuilds: a hydrate error in Preferences, and Fix is a plain write."
          onPress={onCorruptThemePress}
          onHint={setHint}
        />
        <Control
          icon={Wrench}
          label="Plant v1 data"
          description="Writes the old legacyTheme key and version 1, then rebuilds: the migration runs and the theme comes back dark."
          onPress={onPlantLegacyDataPress}
          onHint={setHint}
        />
        <Control
          icon={ArrowClockwise}
          label="Recreate store"
          description="A fresh store over the same flags. Values come back from wherever they live."
          onPress={onRecreatePress}
          onHint={setHint}
        />
      </ul>
      <p
        aria-live="polite"
        className="min-h-8 text-xs text-zinc-600 dark:text-zinc-400"
      >
        {hint ?? IDLE_HINT}
      </p>
    </section>
  );
};
