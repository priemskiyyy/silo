const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * SecureStore accepts only `[A-Za-z0-9._-]` in a key, and a silo physical key
 * carries `:` and whatever a scope segment held, so every key reaches the
 * module as the unpadded base64url of its UTF-8 bytes. Hand rolled because
 * `btoa` and `Buffer` are not both present on every React Native runtime.
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
      encoded += ALPHABET.charAt((buffer >> bits) & 63);
    }

    // Retain only unconsumed bits to avoid overflowing the accumulator.
    buffer &= (1 << bits) - 1;
  }

  if (bits > 0) {
    encoded += ALPHABET.charAt((buffer << (6 - bits)) & 63);
  }

  return encoded;
};
