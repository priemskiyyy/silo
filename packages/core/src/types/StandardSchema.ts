// Inlined rather than depended on, even as types: core ships zero dependencies.
type StandardSchemaResult<TValue> =
  | { value: TValue; issues?: undefined }
  | { issues: ReadonlyArray<{ message: string }> };

/**
 * The part of the Standard Schema v1 contract a value definition reads: a
 * validator that answers with the value or with issues. Zod, Valibot and
 * ArkType all implement it.
 *
 * @example
 * ```ts
 * const user = value({ schema: z.object({ name: z.string() }) });
 * ```
 */
export type StandardSchema<TValue> = {
  "~standard": {
    version: 1;
    vendor: string;
    validate: (
      value: unknown,
    ) => StandardSchemaResult<TValue> | Promise<StandardSchemaResult<TValue>>;
  };
};
