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
