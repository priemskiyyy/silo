import { expectTypeOf } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import { Silo, value } from "@priemskiyyy/silo";
import type {
  SiloScope,
  SiloStatus,
  Storages,
  ValueStatus,
} from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import type { SiloProviderProps } from "src/context/SiloProvider";
import { useNativeStorage } from "src/hooks/useNativeStorage";
import { useScope } from "src/hooks/useScope";
import { useSilo } from "src/hooks/useSilo";
import { useSiloStatus } from "src/hooks/useSiloStatus";
import { useValue } from "src/hooks/useValue";
import { useValueStatus } from "src/hooks/useValueStatus";
import type {
  RegisteredKey,
  RegisteredStorages,
  RegisteredValue,
} from "src/types/Register";

const Schema = {
  theme: value<"light" | "dark">({ fallback: "light" }),
  user: value<{ id: string }>(),
};

const silo = new Silo({
  storages: {
    default: { adapters: [createMockAdapter().adapter], schema: Schema },
  },
});

// A store typed with its own schema and native storage is accepted by the
// provider without registering anything, which is what keeps the untyped path
// usable.
expectTypeOf(silo).toExtend<SiloProviderProps["silo"]>();

export const useTypeContracts = () => {
  // Nothing is registered inside the package, so every key is open.
  expectTypeOf<RegisteredStorages>().toEqualTypeOf<Storages>();
  expectTypeOf<RegisteredKey>().toEqualTypeOf<string>();
  expectTypeOf<RegisteredValue<"theme">>().toEqualTypeOf<unknown>();
  expectTypeOf(useSilo()).toEqualTypeOf<Silo<Storages>>();
  expectTypeOf(useScope()).toEqualTypeOf<SiloScope<Storages>>();
  expectTypeOf(useNativeStorage()).toEqualTypeOf<{
    [name: string]: unknown;
    default: unknown;
  }>();
  expectTypeOf(useValueStatus("theme")).toEqualTypeOf<ValueStatus>();
  expectTypeOf(useSiloStatus()).toEqualTypeOf<SiloStatus>();

  const [snapshot, setValue] = useValue("theme");
  expectTypeOf(snapshot).toEqualTypeOf<unknown>();
  expectTypeOf(setValue).toEqualTypeOf<Dispatch<SetStateAction<unknown>>>();

  useValue("theme", (next) => {
    expectTypeOf(next).toEqualTypeOf<unknown>();
  });
  useValueStatus("theme", (status) => {
    expectTypeOf(status).toEqualTypeOf<ValueStatus>();
  });
  useSiloStatus((status) => {
    expectTypeOf(status).toEqualTypeOf<SiloStatus>();
  });
};
