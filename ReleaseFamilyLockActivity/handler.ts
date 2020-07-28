import { fromEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Context } from "vm";
import { BonusLeaseModel } from "../models/bonus_lease";
import { trackException } from "../utils/appinsights";
import {
  cosmosErrorsToReadableMessage,
  Failure,
  TransientFailure
} from "../utils/errors";

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
    _: Context,
    input: unknown
  ): Promise<ReleaseFamilyLockActivityResult> => {
    return fromEither(ReleaseFamilyLockActivityInput.decode(input))
      .mapLeft<Failure>(err =>
        Failure.encode({
          kind: "PERMANENT",
          reason: `Invalid input: ${readableReport(err)}`
        })
      )
      .chain(({ familyUID }) =>
        bonusLeaseModel
          .deleteOneById(familyUID)
          .map(__ => familyUID)
          .mapLeft<Failure>(err =>
            err.kind === "COSMOS_ERROR_RESPONSE" && err.error.code === 404
              ? Failure.encode({
                  kind: "PERMANENT",
                  reason: "Lock not found"
                })
              : Failure.encode({
                  kind: "TRANSIENT",
                  reason: `Query error: ${cosmosErrorsToReadableMessage(err)}`
                })
          )
      )
      .fold<ReleaseFamilyLockActivityResult>(
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
        familyUID =>
          ReleaseFamilyLockActivitySuccess.encode({
            familyUID,
            kind: "SUCCESS"
          })
      )
      .run();
  };
}
