import { Context } from "@azure/functions";
import { QueryError } from "documentdb";
import { Either, toError } from "fp-ts/lib/Either";
import { TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusCode } from "../generated/models/BonusCode";
import { FamilyUID } from "../generated/models/FamilyUID";
import {
  BonusActivationModel,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import { BonusLeaseModel } from "../models/bonus_lease";
import { EligibilityCheckModel } from "../models/eligibility_check";

export const FailedBonusActivationInput = t.interface({
  bonusActivation: BonusActivationWithFamilyUID
});

export const FailedBonusActivationSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type FailedBonusActivationSuccess = t.TypeOf<
  typeof FailedBonusActivationSuccess
>;

export const InvalidInputFailure = t.interface({
  kind: t.literal("INVALID_INPUT")
});
export type InvalidInputFailure = t.TypeOf<typeof InvalidInputFailure>;

export const UnhandledFailure = t.interface({
  kind: t.literal("UNHANDLED_FAILURE"),
  reason: t.string
});
export type UnhandledFailure = t.TypeOf<typeof UnhandledFailure>;

export const TransientFailure = t.interface({
  kind: t.literal("TRANSIENT")
});
export type TransientFailure = t.TypeOf<typeof TransientFailure>;

const FailedBonusActivationFailure = t.union(
  [InvalidInputFailure, UnhandledFailure, TransientFailure],
  "FailedBonusActivationFailure"
);
export type FailedBonusActivationFailure = t.TypeOf<
  typeof FailedBonusActivationFailure
>;

export const FailedBonusActivationResult = t.taggedUnion("kind", [
  FailedBonusActivationSuccess,
  FailedBonusActivationFailure
]);
export type FailedBonusActivationResult = t.TypeOf<
  typeof FailedBonusActivationResult
>;

type IFailedBonusActivationHandler = (
  context: Context,
  input: unknown
) => Promise<FailedBonusActivationResult>;

/**
 * Converts a Promise<Either> into a TaskEither
 * This is needed because our models return unconvenient type. Both left and rejection cases are handled as a TaskEither left
 * @param lazyPromise a lazy promise to convert
 *
 * @returns either the query result or a query failure
 */
const fromQueryEither = <R>(
  lazyPromise: () => Promise<Either<QueryError | Error, R>>
): TaskEither<Error, R> =>
  tryCatch(lazyPromise, toError).chain(errorOrResult =>
    fromEither(errorOrResult).mapLeft(toError)
  );

/**
 * Release the lock that was eventually acquired for this request. A release attempt on a lock that doesn't exist is considered successful.
 *
 * @param bonusLeaseModel an instance of BonusLeaseModel
 * @param familyMembers the family of the requesting user
 *
 */
const relaseLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<Error, void> => {
  return fromQueryEither(() => bonusLeaseModel.deleteOneById(familyUID)).map(
    _ => void 0
  );
};

const updateBonusAsFailed = (
  bonusActivationModel: BonusActivationModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<Error, RetrievedBonusActivation> => {
  return fromQueryEither(() => {
    const bonusToUpdate: BonusActivationWithFamilyUID = {
      ...bonusActivation,
      status: BonusActivationStatusEnum.FAILED
    };
    return bonusActivationModel.replace(bonusToUpdate);
  });
};

const deleteEligibilityCheck = (
  eligibilityCheckModel: EligibilityCheckModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<Error, string> => {
  return fromQueryEither(() =>
    eligibilityCheckModel.deleteOneById(
      bonusActivation.id as BonusCode & NonEmptyString
    )
  );
};

/**
 * Operations to be perfomed in case the bonus request was rejected by ADE
 *
 *
 * @returns either a success or a failure request
 * @throws when the response is considered a transient failure and thus is not considered a domain message
 */
export function FailedBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  bonusLeaseModel: BonusLeaseModel,
  eligibilityCheckModel: EligibilityCheckModel
): IFailedBonusActivationHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<FailedBonusActivationResult> => {
    return taskEither
      .of<FailedBonusActivationFailure, void>(void 0)
      .chain(_ =>
        fromEither(FailedBonusActivationInput.decode(input))
          .mapLeft(() => InvalidInputFailure.encode({ kind: "INVALID_INPUT" }))
          .map(({ bonusActivation }) => bonusActivation)
      )
      .chain(bonusActivation =>
        deleteEligibilityCheck(eligibilityCheckModel, bonusActivation)
          // just ignore this error
          .foldTaskEither(
            err => {
              context.log.warn(
                `FailedBonusActivationHandler|WARN|Failed deleting dsu: ${err.message}`
              );
              return taskEither.of(bonusActivation);
            },
            _ => taskEither.of(bonusActivation)
          )
      )
      .chain(bonusActivation =>
        updateBonusAsFailed(bonusActivationModel, bonusActivation)
          // just ignore this error
          .foldTaskEither(
            err => {
              context.log.warn(
                `FailedBonusActivationHandler|WARN|Failed updating bonus: ${err.message}`
              );
              return taskEither.of(bonusActivation);
            },
            _ => taskEither.of(bonusActivation)
          )
      )
      .chain(bonusActivation =>
        relaseLockForUserFamily(
          bonusLeaseModel,
          bonusActivation.familyUID
        ).mapLeft(err => {
          context.log.warn(
            `FailedBonusActivationHandler|WARN|Failed releasing lock: ${err.message}`
          );
          return UnhandledFailure.encode({
            kind: "UNHANDLED_FAILURE",
            reason: err.message
          });
        })
      )
      .fold<FailedBonusActivationResult>(
        l => l,
        () => FailedBonusActivationSuccess.encode({ kind: "SUCCESS" })
      )
      .run();
  };
}
