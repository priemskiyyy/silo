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
