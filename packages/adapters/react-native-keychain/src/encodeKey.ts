import { BASE64URL_ALPHABET } from "src/constants/alphabet";

/**
 * A silo physical key carries `:` and whatever a scope segment held, and the
 * Android keystore aliases and shared preferences behind react-native-keychain
 * do not take every character, so every key reaches the keychain as the
 * unpadded base64url of its UTF-8 bytes. Hand rolled because `btoa` and
 * `Buffer` are not both present on every React Native runtime.
 *
 * @example
 * ```ts
 * encodeKey("silo:token"); // "c2lsbzp0b2tlbg"
 * ```
 */
export const encodeKey = (key: string) => {
  let encoded = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of new TextEncoder().encode(key)) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 6) {
      bits -= 6;
      encoded += BASE64URL_ALPHABET.charAt((buffer >> bits) & 63);
    }

    // Retain only unconsumed bits to avoid overflowing the accumulator.
    buffer &= (1 << bits) - 1;
  }

  if (bits > 0) {
    encoded += BASE64URL_ALPHABET.charAt((buffer << (6 - bits)) & 63);
  }

  return encoded;
};
