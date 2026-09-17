/** A reactive snapshot getter. @example `const status: ReadableValue<ValueStatus> = useValueStatus("theme");` */
export type ReadableValue<TValue> = { get current(): TValue };
