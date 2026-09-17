import { createTextStorageAdapter } from "@priemskiyyy/silo";
import { decodeKey } from "src/decodeKey";
import { encodeKey } from "src/encodeKey";
import type { KeychainAdapterOptions } from "src/types/KeychainAdapterOptions";

const alwaysAvailable = () => true;

/**
 * Stores JSON text in react-native-keychain, with one encoded service per key.
 *
 * @example
 * ```ts
 * const adapter = keychain({ keychain: Keychain, service: { prefix: "acme." } });
 * ```
 */
export const keychain = ({
  keychain,
  service: { prefix = "silo." } = {},
  options,
  available = alwaysAvailable,
  format,
}: KeychainAdapterOptions) => {
  const optionsFor = (key: string) => ({
    ...options,
    service: `${prefix}${encodeKey(key)}`,
  });

  return createTextStorageAdapter({
    mode: "async",
    name: "react-native-keychain",
    native: keychain,
    format,
    read: async (key) => {
      const entry = await keychain.getGenericPassword(optionsFor(key));

      return entry === false ? undefined : entry.password;
    },
    write: async (key, text) => {
      const stored = await keychain.setGenericPassword(
        key,
        text,
        optionsFor(key),
      );

      if (stored === false) {
        throw new Error(
          `The react-native-keychain adapter could not store "${key}": the keychain refused the entry.`,
        );
      }
    },
    remove: async (key) => {
      await keychain.resetGenericPassword(optionsFor(key));
    },
    keys: async () =>
      (await keychain.getAllGenericPasswordServices()).flatMap((service) => {
        if (!service.startsWith(prefix)) {
          return [];
        }

        const key = decodeKey(service.slice(prefix.length));

        return key === null ? [] : [key];
      }),
    available,
    dispose: () => {},
  });
};
