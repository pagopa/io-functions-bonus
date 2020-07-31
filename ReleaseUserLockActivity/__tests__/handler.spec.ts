// tslint:disable: no-any
import * as t from "io-ts";

import * as fc from "fast-check";

import { fromLeft } from "fp-ts/lib/TaskEither";
import { aNotFoundQueryError } from "../../__mocks__/mocks";
import { getArbitrary } from "../../__tests__/fc-io.helper";
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
  const context = {
    log: {}
  };
  it("should fail permanently when lock does not exist", async () => {
    await fc.assert(
      fc.asyncProperty(releaseUserLockActivityInputArb, async input => {
        const model = {
          deleteOneById: (_: unknown) => fromLeft(aNotFoundQueryError)
        };
        const handler = getReleaseUserLockActivityHandler(model as any);
        const result = await handler(context as any, input);
        expect(result).toBeDefined();
      })
    );
  });
});
