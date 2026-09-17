/**
 * Capacitor Preferences methods used by the adapter.
 *
 * @example
 * ```ts
 * import { Preferences } from "@capacitor/preferences";
 *
 * const preferences: PreferencesPlugin = Preferences;
 * ```
 */
export type PreferencesPlugin = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
};
