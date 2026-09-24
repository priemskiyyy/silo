import { BASE64URL_ALPHABET } from "src/constants/alphabet";

/**
 * The inverse of `encodeKey`, for listing what the keychain holds. A service
 * name that is not base64url, or whose bytes are not UTF-8, was not written by
 * this adapter and decodes to `null`, so a foreign entry under the same prefix
 * is skipped rather than listed as garbage.
 *
 * @example
 * ```ts
 * decodeKey("c2lsbzp0b2tlbg"); // "silo:token"
 * ```
 */
export const decodeKey = (encoded: string): string | null => {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of encoded) {
    const value = BASE64URL_ALPHABET.indexOf(character);

    if (value === -1) {
      return null;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }

  // Hermes has no TextDecoder. Percent decoding is UTF-8 decoding, and it
  // throws on bytes that are not UTF-8.
  try {
    return decodeURIComponent(
      bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join(""),
    );
  } catch {
    return null;
  }
};
