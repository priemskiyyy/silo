/**
 * Expo SecureStore options forwarded to each operation.
 *
 * @example
 * ```ts
 * const options: SecureStoreOptions = { requireAuthentication: true, authenticationPrompt: "Unlock your session" };
 * ```
 */
export type SecureStoreOptions = {
  keychainService?: string;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
};
