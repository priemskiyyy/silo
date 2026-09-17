import type { TextFormat } from "@priemskiyyy/silo";
import type { CloudStoreModule } from "src/types/CloudStoreModule";

/**
 * Options for `icloud()`.
 *
 * @example
 * ```ts
 * const adapter = icloud({ store: CloudStore, available: () => Platform.OS === "ios" });
 * ```
 */
export type IcloudAdapterOptions = {
  store: CloudStoreModule;
  /**
   * What the availability probe answers. The module is iOS only, so an
   * application that also ships on Android passes `() => Platform.OS === "ios"`
   * and lists a second adapter after this one. Defaults to always available.
   */
  available?: () => boolean;
  /** Serialization format. Defaults to JSON; changing it requires migrating existing data. */
  format?: TextFormat;
};
