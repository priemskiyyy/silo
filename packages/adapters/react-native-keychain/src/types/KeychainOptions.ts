/**
 * Options forwarded to react-native-keychain. The adapter supplies service per key.
 *
 * @example
 * ```ts
 * const adapter = keychain({ keychain: Keychain, options: { accessControl: "BiometryCurrentSet" } });
 * ```
 */
export type KeychainOptions = {
  accessible?: string;
  accessControl?: string;
  authenticationPrompt?: {
    title?: string;
    subtitle?: string;
    description?: string;
    cancel?: string;
  };
};
