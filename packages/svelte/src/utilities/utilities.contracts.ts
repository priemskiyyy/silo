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
