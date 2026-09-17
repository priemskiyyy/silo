import type { TextFormat } from "@priemskiyyy/silo";
import type { PreferencesPlugin } from "src/types/PreferencesPlugin";

/**
 * Options for `capacitorPreferences()`.
 *
 * @example
 * ```ts
 * const adapter = capacitorPreferences({ preferences: Preferences, available: () => Capacitor.isNativePlatform() });
 * ```
 */
export type CapacitorPreferencesAdapterOptions = {
  /** The `Preferences` plugin, configured by the application. */
  preferences: PreferencesPlugin;
  /** Overrides availability. Defaults to true. */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
