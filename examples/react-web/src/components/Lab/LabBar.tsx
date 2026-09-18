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
import { useId } from "react";
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
};

const Control: React.FunctionComponent<ControlProps> = ({
  icon: ControlIcon,
  label,
  description,
  pressed,
  onPress,
}) => {
  const descriptionId = useId();

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <button
        type="button"
        aria-describedby={descriptionId}
        onClick={onPress}
        {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
        className={buttonStyles({ pressed: pressed === true })}
      >
        <ControlIcon size={14} weight="bold" />
        {label}
      </button>
      <p
        id={descriptionId}
        className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400"
      >
        {description}
      </p>
    </li>
  );
};

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
      <ul className="grid gap-3 sm:grid-cols-2">
        <Control
          icon={LockKey}
          label="Private mode"
          description="Use temporary memory instead of localStorage. Reloading will lose edits made in this mode."
          pressed={flags.privateMode}
          onPress={onPrivateModeToggle}
        />
        <Control
          icon={Timer}
          label="Slow journal"
          description="Add a short delay to journal reads and writes to see loading and saving states."
          pressed={flags.slowJournal}
          onPress={onSlowJournalToggle}
        />
        <Control
          icon={Bug}
          label="Fail next write"
          description="After pressing this, save a Composer entry. It will fail once; Retry saves it again."
          onPress={onFailNextWritePress}
        />
        <Control
          icon={Sparkle}
          label="Corrupt theme"
          description="Replace the saved theme with invalid data. Preferences will show an error and a Fix theme button."
          onPress={onCorruptThemePress}
        />
        <Control
          icon={Wrench}
          label="Plant v1 data"
          description="Load an older theme format. The migration should restore it as the dark theme."
          onPress={onPlantLegacyDataPress}
        />
        <Control
          icon={ArrowClockwise}
          label="Recreate store"
          description="Reload stored values without refreshing the page. In-memory edits are discarded."
          onPress={onRecreatePress}
        />
      </ul>
    </section>
  );
};
