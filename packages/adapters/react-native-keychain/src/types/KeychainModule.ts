import type { KeychainOptions } from "src/types/KeychainOptions";

/**
 * Keychain methods used by the adapter. Entries are addressed by service.
 *
 * @example
 * ```ts
 * import * as Keychain from "react-native-keychain";
 *
 * const module: KeychainModule = Keychain;
 * ```
 */
export type KeychainModule = {
  setGenericPassword(
    username: string,
    password: string,
    options?: KeychainOptions & { service?: string },
  ): Promise<false | { service: string; storage: string }>;
  getGenericPassword(
    options?: KeychainOptions & { service?: string },
  ): Promise<
    | false
    | { username: string; password: string; service: string; storage: string }
  >;
  resetGenericPassword(
    options?: KeychainOptions & { service?: string },
  ): Promise<boolean>;
  getAllGenericPasswordServices(): Promise<string[]>;
};
