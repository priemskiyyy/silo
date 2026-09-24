// Hermes, the engine of a bare React Native app, has no structuredClone, and
// the memory adapter is where a candidate list lands when nothing else is
// available, so it copies the same corpus itself: shared and circular
// references stay shared, a class instance becomes a plain object, and a
// function or a symbol is refused with the error structuredClone would throw.
const copyValue = (value: unknown, copies: Map<object, unknown>): unknown => {
  if (typeof value === "function" || typeof value === "symbol") {
    throw Object.assign(new Error(`A ${typeof value} could not be cloned.`), {
      name: "DataCloneError",
    });
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (copies.has(value)) {
    return copies.get(value);
  }

  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    copies.set(value, copy);

    return copy;
  }

  if (value instanceof RegExp) {
    const copy = new RegExp(value.source, value.flags);
    copies.set(value, copy);

    return copy;
  }

  if (value instanceof ArrayBuffer) {
    const copy = value.slice(0);
    copies.set(value, copy);

    return copy;
  }

  if (ArrayBuffer.isView(value)) {
    const copy: unknown = Reflect.construct(value.constructor, [
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    ]);
    copies.set(value, copy);

    return copy;
  }

  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    copies.set(value, copy);
    for (const [key, item] of value) {
      copy.set(copyValue(key, copies), copyValue(item, copies));
    }

    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set<unknown>();
    copies.set(value, copy);
    for (const item of value) {
      copy.add(copyValue(item, copies));
    }

    return copy;
  }

  const copy = Array.isArray(value) ? new Array<unknown>(value.length) : {};
  copies.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(copy, key, {
      value: copyValue(item, copies),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  return copy;
};

/**
 * Copies a value with `structuredClone`, or with the adapter's own copy of the
 * same corpus where the runtime has none.
 *
 * @example
 * ```ts
 * const copy = cloneValue({ at: new Date(0), tags: new Set(["a"]) });
 * ```
 */
export const cloneValue = (value: unknown) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : copyValue(value, new Map());
