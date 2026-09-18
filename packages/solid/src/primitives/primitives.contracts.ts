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
  expectTypeOf(useSilo()()).toEqualTypeOf<Silo<Storages>>();
  expectTypeOf(useScope()()).toEqualTypeOf<SiloScope<Storages>>();
  expectTypeOf(useNativeStorage()()).toEqualTypeOf<Silo["native"]>();
  expectTypeOf(useSiloStatus()()).toEqualTypeOf<SiloStatus>();
  expectTypeOf(useValueStatus("theme")()).toEqualTypeOf<ValueStatus>();
  const [snapshot, setSnapshot] = useValue("theme");
  expectTypeOf(snapshot()).toEqualTypeOf<unknown>();
  expectTypeOf(setSnapshot).toEqualTypeOf<(value: unknown) => unknown>();
};

export const checkHandleContracts = (
  handle: SiloValue<number>,
  optional: SiloValue<number> | undefined,
) => {
  const [snapshot, setSnapshot] = useValue(handle);
  expectTypeOf(snapshot()).toEqualTypeOf<number>();
  setSnapshot((previous) => previous + 1);
  useValue(handle, (next) => {
    expectTypeOf(next).toEqualTypeOf<number>();
  });
  useValueStatus(handle);
  // @ts-expect-error handle setters preserve their value type without registration
  setSnapshot("wrong");
  // @ts-expect-error an unavailable handle must be guarded before binding
  useValue(optional);
  // @ts-expect-error callbacks must accept the handle's value type
  useValue(handle, (next: string) => {
    expectTypeOf(next).toEqualTypeOf<string>();
  });
};
