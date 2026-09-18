import type { SiloValue } from "@priemskiyyy/silo";
import { expectTypeOf } from "vitest";
import type {
  Silo,
  SiloScope,
  Storages,
  SiloStatus,
  ValueStatus,
} from "@priemskiyyy/silo";
import {
  useSilo,
  useScope,
  useNativeStorage,
  useSiloStatus,
  useValue,
  useValueStatus,
} from "../index.js";
import type { RegisteredKey, RegisteredStorages } from "../index.js";

export const checkContracts = () => {
  expectTypeOf<RegisteredKey>().toEqualTypeOf<string>();
  expectTypeOf<RegisteredStorages>().toEqualTypeOf<Storages>();
  expectTypeOf(useSilo().current).toEqualTypeOf<Silo<Storages>>();
  expectTypeOf(useScope().current).toEqualTypeOf<SiloScope<Storages>>();
  expectTypeOf(useNativeStorage().current).toEqualTypeOf<Silo["native"]>();
  expectTypeOf(useSiloStatus().current).toEqualTypeOf<SiloStatus>();
  expectTypeOf(useValueStatus("theme").current).toEqualTypeOf<ValueStatus>();
  const snapshot = useValue("theme");
  expectTypeOf(snapshot.current).toEqualTypeOf<unknown>();
};

export const checkHandleContracts = (
  handle: SiloValue<number>,
  optional: SiloValue<number> | undefined,
) => {
  const snapshot = useValue(() => handle);
  expectTypeOf(snapshot.current).toEqualTypeOf<number>();
  snapshot.current += 1;
  useValue(handle, (next) => {
    expectTypeOf(next).toEqualTypeOf<number>();
  });
  useValueStatus(handle);
  // @ts-expect-error handle setters preserve their value type without registration
  snapshot.current = "wrong";
  // @ts-expect-error an unavailable handle must be guarded before binding
  useValue(optional);
  // @ts-expect-error callbacks must accept the handle's value type
  useValue(handle, (next: string) => {
    expectTypeOf(next).toEqualTypeOf<string>();
  });
};
