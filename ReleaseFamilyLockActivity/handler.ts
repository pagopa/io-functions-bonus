import { fromEither } from "fp-ts/lib/TaskEither";
import {
  fromQueryEither,
  QueryError
} from "io-functions-commons/dist/src/utils/documentdb";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Context } from "vm";
import { BonusLeaseModel } from "../models/bonus_lease";
import { trackEvent, trackException } from "../utils/appinsights";
import { Failure } from "../utils/errors";

export const ReleaseFamilyLockActivitySuccess = t.type({
  familyUID: NonEmptyString,
  kind: t.literal("SUCCESS")
});
export type ReleaseFamilyLockActivitySuccess = t.TypeOf<
  typeof ReleaseFamilyLockActivitySuccess
>;

export const ReleaseFamilyLockActivityResult = t.taggedUnion("kind", [
  Failure,
  ReleaseFamilyLockActivitySuccess
]);
export type ReleaseFamilyLockActivityResult = t.TypeOf<
  typeof ReleaseFamilyLockActivityResult
>;

export const ReleaseFamilyLockActivityInput = t.type({
  familyUID: NonEmptyString
});

type IReleaseFamilyLockActivityHandler = (
  context: Context,
  input: unknown
) => Promise<ReleaseFamilyLockActivityResult>;

export function getReleaseFamilyLockActivityHandler(
  bonusLeaseModel: BonusLeaseModel,
  logPrefix = `ReleaseFamilyLockActivity`
): IReleaseFamilyLockActivityHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<ReleaseFamilyLockActivityResult> => {
    return fromEither(ReleaseFamilyLockActivityInput.decode(input))
      .mapLeft<QueryError>(err => ({
        body: readableReport(err),
        code: "error"
      }))
      .chain(({ familyUID }) =>
        fromQueryEither(() => bonusLeaseModel.deleteOneById(familyUID)).map(
          _ => familyUID
        )
      )
      .fold<ReleaseFamilyLockActivityResult>(
        err => {
          if (err.code !== 404) {
            // trigger a retry in case of failures
            const ex = new Error(
              `${logPrefix}|Error releasing lock: ${err.code}=${err.body}`
            );
            trackException({
              exception: ex,
              properties: {
                name: "bonus.activation.failure.unlock"
              }
            });
            throw ex;
          }
          return Failure.encode({
            kind: "PERMANENT",
            reason: "Lock not found"
          });
        },
        familyUID =>
          ReleaseFamilyLockActivitySuccess.encode({
            familyUID,
            kind: "SUCCESS"
          })
      )
      .run();
  };
}
