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
} from "src/index";
import type { RegisteredKey, RegisteredStorages } from "src/index";

export const checkContracts = () => {
  expectTypeOf<RegisteredKey>().toEqualTypeOf<string>();
  expectTypeOf<RegisteredStorages>().toEqualTypeOf<Storages>();
  expectTypeOf(useSilo().value).toEqualTypeOf<Silo<Storages>>();
  expectTypeOf(useScope().value).toEqualTypeOf<SiloScope<Storages>>();
  expectTypeOf(useNativeStorage().value).toEqualTypeOf<Silo["native"]>();
  expectTypeOf(useSiloStatus().value).toEqualTypeOf<SiloStatus>();
  expectTypeOf(useValueStatus("theme").value).toEqualTypeOf<ValueStatus>();
  const snapshot = useValue("theme");
  expectTypeOf(snapshot.value).toEqualTypeOf<unknown>();
};

export const checkHandleContracts = (
  handle: SiloValue<number>,
  optional: SiloValue<number> | undefined,
) => {
  const snapshot = useValue(() => handle);
  expectTypeOf(snapshot.value).toEqualTypeOf<number>();
  snapshot.value += 1;
  useValue(handle, (next) => {
    expectTypeOf(next).toEqualTypeOf<number>();
  });
  useValueStatus(handle);
  // @ts-expect-error handle setters preserve their value type without registration
  snapshot.value = "wrong";
  // @ts-expect-error an unavailable handle must be guarded before binding
  useValue(optional);
  // @ts-expect-error callbacks must accept the handle's value type
  useValue(handle, (next: string) => {
    expectTypeOf(next).toEqualTypeOf<string>();
  });
};
