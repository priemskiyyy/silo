import type { Codec } from "src/types/Codec";
import type { Expiration } from "src/types/Expiration";

/**
 * One schema entry: the codec a key is translated with, what it reads as when
 * absent, and when it expires.
 *
 * `TFallback` is `TValue` for a key that declares a fallback and `undefined`
 * for one that does not, which is what carries into the inferred value type.
 * The fallback is a read-time substitute and is never persisted. A key without
 * `expires` persists bare, with no envelope of any kind.
 *
 * @example
 * ```ts
 * const theme: ValueDefinition<Theme, Theme> = value<Theme>({ fallback: "light" });
 * const user: ValueDefinition<User, undefined> = value<User>();
 * ```
 */
export type ValueDefinition<
  TValue,
  TFallback extends TValue | undefined = TValue | undefined,
> = Codec<TValue> & {
  fallback: TFallback;
  expires: Expiration | undefined;
};
