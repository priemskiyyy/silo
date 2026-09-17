import { expect, test } from "vitest";
import { parsePreferences } from "src/utils/parsePreferences";

test("keeps well-formed fields and forgets the rest", () => {
  expect(
    parsePreferences({
      isOpen: true,
      position: "right",
      height: 300,
      width: 500,
      extra: 1,
    }),
  ).toEqual({ isOpen: true, position: "right", height: 300, width: 500 });
  expect(
    parsePreferences({
      isOpen: "yes",
      position: "top",
      height: -1,
      width: 1.5,
    }),
  ).toEqual({});
  expect(parsePreferences(null)).toEqual({});
  expect(parsePreferences("[]")).toEqual({});
});
