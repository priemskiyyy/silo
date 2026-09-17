import type { Preferences } from "src/types/Preferences";

const isSize = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** Keeps only the fields a stored value spells correctly; anything else is forgotten, never thrown on. */
export const parsePreferences = (raw: unknown): Preferences => {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }

  const preferences: Preferences = {};

  if ("isOpen" in raw && typeof raw.isOpen === "boolean") {
    preferences.isOpen = raw.isOpen;
  }

  if (
    "position" in raw &&
    (raw.position === "bottom" || raw.position === "right")
  ) {
    preferences.position = raw.position;
  }

  if ("height" in raw && isSize(raw.height)) {
    preferences.height = raw.height;
  }

  if ("width" in raw && isSize(raw.width)) {
    preferences.width = raw.width;
  }

  return preferences;
};
