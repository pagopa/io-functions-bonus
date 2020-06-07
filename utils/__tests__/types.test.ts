import { keys } from "../types";

describe("keys", () => {
  it("should return the correct set of keys", () => {
    const obj = { a: 1, b: 2 };
    const result: ReadonlyArray<keyof typeof obj> = keys(obj);
    expect(result).toEqual(["a", "b"]);
  });

  it("should return an empty array for an empty object", () => {
    const obj = {};
    const result: ReadonlyArray<keyof typeof obj> = keys(obj);
    expect(result).toEqual([]);
  });
});
