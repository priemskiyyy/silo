import type React from "react";
import { BellSlash, SlidersHorizontal, Wrench } from "@phosphor-icons/react";
import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import type { ReactNode } from "react";
import { Badge } from "src/components/Badge/Badge";
import { Panel } from "src/components/Panel/Panel";
import { SegmentedControl } from "src/components/SegmentedControl/SegmentedControl";
import { formatClockTime } from "src/formatting/formatClockTime";
import { formatCountdown } from "src/formatting/formatCountdown";
import { useNow } from "src/hooks/useNow";
import type { Density, Theme, Units } from "src/silo/createFieldbookSilo";
import { QUIET_HOURS_LENGTH } from "src/silo/createFieldbookSilo";
import { buttonStyles } from "src/styles/buttonStyles";
import type { Place } from "src/utils/describeStorages";

type PreferencesPanelProps = {
  livesIn: Place[];
};

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] satisfies { value: Theme; label: string }[];
const DENSITY_OPTIONS = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
] satisfies { value: Density; label: string }[];
const UNITS_OPTIONS = [
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
] satisfies { value: Units; label: string }[];

type FieldProps = {
  label: string;
  children: ReactNode;
};

const Field: React.FunctionComponent<FieldProps> = ({ label, children }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-sm">{label}</span>
    {children}
  </div>
);

/**
 * One strip, three storages: theme, density and visits in localStorage,
 * units in a cookie a server would see on every request, and quiet hours
 * with an expiry the core checks when the raw value arrives. The theme is
 * the page's one theme control, and a corrupt raw (the Lab can write one)
 * reads as the fallback with a hydrate error that any write fixes.
 */
export const PreferencesPanel: React.FunctionComponent<
  PreferencesPanelProps
> = ({ livesIn }) => {
  const now = useNow(1_000);
  const [theme, setTheme] = useValue("theme");
  const themeStatus = useValueStatus("theme");
  const [density, setDensity] = useValue("density");
  const [units, setUnits] = useValue("preferences.units");
  const [visits] = useValue("visits");
  const [quietUntil, setQuietUntil] = useValue("quietUntil");
  const quiet = quietUntil !== undefined && quietUntil > now;

  return (
    <Panel
      title="Preferences"
      icon={SlidersHorizontal}
      shows="These preferences apply across all your notebooks."
      livesIn={livesIn}
      aside={
        <Badge tone="neutral">
          <span className="tabular-nums">{visits}</span> visits
        </Badge>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Field label="Theme">
          <SegmentedControl
            label="Theme"
            options={THEME_OPTIONS}
            value={theme}
            onSelect={setTheme}
          />
          {themeStatus.state === "error" ? (
            <>
              <Badge tone="danger">
                {themeStatus.error.phase === "write"
                  ? "Could not save theme"
                  : "Could not load theme"}
              </Badge>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={buttonStyles({ variant: "primary", size: "small" })}
              >
                <Wrench size={12} weight="bold" />
                Fix theme
              </button>
            </>
          ) : null}
        </Field>
        <Field label="Density">
          <SegmentedControl
            label="Density"
            options={DENSITY_OPTIONS}
            value={density}
            onSelect={setDensity}
          />
        </Field>
        <Field label="Units">
          <SegmentedControl
            label="Units"
            options={UNITS_OPTIONS}
            value={units}
            onSelect={setUnits}
          />
        </Field>
        <Field label="Quiet hours">
          <button
            type="button"
            aria-pressed={quiet}
            onClick={() =>
              setQuietUntil(quiet ? undefined : now + QUIET_HOURS_LENGTH)
            }
            className={buttonStyles({ pressed: quiet, size: "small" })}
          >
            <BellSlash size={12} weight="bold" />
            {quiet ? "End quiet hours" : "Start quiet hours"}
          </button>
          {quietUntil === undefined ? null : (
            <Badge tone={quiet ? "accent" : "neutral"}>
              {quiet ? (
                <>
                  <span className="font-mono tabular-nums">
                    {formatCountdown(quietUntil - now)}
                  </span>
                  until {formatClockTime(quietUntil)}
                </>
              ) : (
                "Expired: dropped on the next read, reload to see it gone"
              )}
            </Badge>
          )}
        </Field>
      </div>
    </Panel>
  );
};
