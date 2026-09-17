import { expect, test } from "vitest";
import * as api from "src/index";

test("the package exposes the provider and hooks without runtime internals", () => {
  expect(Object.keys(api).sort()).toEqual([
    "SiloProvider",
    "useNativeStorage",
    "useScope",
    "useSilo",
    "useSiloStatus",
    "useValue",
    "useValueStatus",
  ]);
});
