import type { Codec } from "@priemskiyyy/silo";

/** A number kept as plain text in the URL; a hand-edited value that is not an integer reads as a hydrate error. */
export const integerCodec: Codec<number> = {
  encode: (count) => String(count),
  decode: (raw) => {
    const count = Number(raw);

    if (!Number.isInteger(count)) {
      throw new Error(
        `Expected an integer in the URL, received "${String(raw)}".`,
      );
    }

    return count;
  },
};
