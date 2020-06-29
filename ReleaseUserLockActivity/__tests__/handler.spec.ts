// tslint:disable: no-any
import * as t from "io-ts";

import * as fc from "fast-check";

import { getArbitrary } from "../../__tests__/fc-io.helper";

import { left } from "fp-ts/lib/Either";
import {
  getReleaseUserLockActivityHandler,
  ReleaseUserLockActivityInput
} from "../handler";

const QueryError = t.interface({
  body: t.string,
  code: t.union([
    t.literal(401),
    t.literal(404),
    t.literal(409),
    t.literal(500)
  ])
});

describe("ReleaseUserLockActivityHandler", () => {
  const releaseUserLockActivityInputArb = getArbitrary(
    ReleaseUserLockActivityInput
  );
  const queryError404 = QueryError.encode({
    body: "not found",
    code: 404
  });
  const context = {
    log: {}
  };
  it("should fail permanently when lock does not exist", async () => {
    await fc.assert(
      fc.asyncProperty(releaseUserLockActivityInputArb, async input => {
        const model = {
          deleteOneById: (_: unknown) => Promise.resolve(left(queryError404))
        };
        const handler = getReleaseUserLockActivityHandler(model as any);
        const result = await handler(context as any, input);
        expect(result).toBeDefined();
      })
    );
  });
});
