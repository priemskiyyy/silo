import { createTextStorageAdapter } from "@priemskiyyy/silo";
import type { CapacitorPreferencesAdapterOptions } from "src/types/CapacitorPreferencesAdapterOptions";

/**
 * Stores JSON text through a configured Capacitor Preferences plugin.
 *
 * @example
 * ```ts
 * const adapter = capacitorPreferences({ preferences: Preferences });
 * ```
 */
export const capacitorPreferences = ({
  preferences,
  available = () => true,
  format,
}: CapacitorPreferencesAdapterOptions) =>
  createTextStorageAdapter({
    mode: "async",
    name: "capacitor-preferences",
    native: preferences,
    format,
    read: async (key) => (await preferences.get({ key })).value,
    write: async (key, text) => {
      await preferences.set({ key, value: text });
    },
    remove: async (key) => {
      await preferences.remove({ key });
    },
    keys: async () => (await preferences.keys()).keys,
    available,
    dispose: () => {},
  });
