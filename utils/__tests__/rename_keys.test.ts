import * as fc from "fast-check";

import { identity } from "fp-ts/lib/function";

import { renameObjectKeys } from "../rename_keys";

describe("renameObjectKeys", () => {
  const objArb = fc.oneof(
    fc.array(fc.anything()),
    fc.object({
      values: [fc.anything(), fc.array(fc.anything())]
    })
  );

  it("should keep objects unchanged", () => {
    fc.assert(
      fc.property(objArb, obj => {
        const renamed = renameObjectKeys(obj, identity);
        expect(renamed).toStrictEqual(obj);
      })
    );
  });
});
