import { fromEither } from "fp-ts/lib/TaskEither";
import { fromQueryEither } from "io-functions-commons/dist/src/utils/documentdb";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { Context } from "vm";
import { BonusProcessingModel } from "../models/bonus_Processing";
import { trackException } from "../utils/appinsights";
import { Failure, TransientFailure } from "../utils/errors";

export const ReleaseUserLockActivitySuccess = t.type({
  id: FiscalCode,
  kind: t.literal("SUCCESS")
});
export type ReleaseUserLockActivitySuccess = t.TypeOf<
  typeof ReleaseUserLockActivitySuccess
>;

export const ReleaseUserLockActivityResult = t.taggedUnion("kind", [
  Failure,
  ReleaseUserLockActivitySuccess
]);
export type ReleaseUserLockActivityResult = t.TypeOf<
  typeof ReleaseUserLockActivityResult
>;

export const ReleaseUserLockActivityInput = t.type({
  // applicant fiscal code
  id: FiscalCode
});

type IReleaseUserLockActivityHandler = (
  context: Context,
  input: unknown
) => Promise<ReleaseUserLockActivityResult>;

export function getReleaseUserLockActivityHandler(
  bonusProcessingModel: BonusProcessingModel,
  logPrefix = `ReleaseUserLockActivity`
): IReleaseUserLockActivityHandler {
  return async (
    _: Context,
    input: unknown
  ): Promise<ReleaseUserLockActivityResult> => {
    return fromEither(ReleaseUserLockActivityInput.decode(input))
      .mapLeft<Failure>(err =>
        Failure.encode({
          kind: "PERMANENT",
          reason: `Invalid input: ${readableReport(err)}`
        })
      )
      .chain(({ id }) =>
        fromQueryEither(() => bonusProcessingModel.deleteOneById(id))
          .map(__ => id)
          .mapLeft<Failure>(err =>
            err.code === 404
              ? Failure.encode({
                  kind: "PERMANENT",
                  reason: "Lock not found"
                })
              : Failure.encode({
                  kind: "TRANSIENT",
                  reason: `Query error: ${err.code}=${err.body}`
                })
          )
      )
      .fold<ReleaseUserLockActivityResult>(
        err => {
          if (TransientFailure.is(err)) {
            const ex = new Error(`${logPrefix}|`);
            trackException({
              exception: ex,
              properties: {
                name: "bonus.activation.failure.unlock"
              }
            });
            // trigger a retry in case of failures
            throw ex;
          }
          return err;
        },
        id =>
          ReleaseUserLockActivitySuccess.encode({
            id,
            kind: "SUCCESS"
          })
      )
      .run();
  };
}
