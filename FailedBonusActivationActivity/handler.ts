import { Context } from "@azure/functions";
import { TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import { fromEither } from "fp-ts/lib/TaskEither";
import {
  fromQueryEither,
  QueryError
} from "io-functions-commons/dist/src/utils/documentdb";
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
import { TransientFailure } from "../utils/errors";

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

const FailedBonusActivationFailure = t.union(
  [InvalidInputFailure, TransientFailure],
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
 * Release the lock that was eventually acquired for this request. A release attempt on a lock that doesn't exist is considered successful.
 *
 * @param bonusLeaseModel an instance of BonusLeaseModel
 * @param familyMembers the family of the requesting user
 *
 */
const relaseLockForUserFamily = (
  bonusLeaseModel: BonusLeaseModel,
  familyUID: FamilyUID
): TaskEither<QueryError, void> => {
  return fromQueryEither(() => bonusLeaseModel.deleteOneById(familyUID)).map(
    _ => void 0
  );
};

const updateBonusAsFailed = (
  bonusActivationModel: BonusActivationModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<QueryError, RetrievedBonusActivation> => {
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
): TaskEither<QueryError, string> => {
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
                `FailedBonusActivationHandler|WARN|Failed deleting dsu: ${err.body}`
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
                `FailedBonusActivationHandler|WARN|Failed updating bonus: ${err.body}`
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
            `FailedBonusActivationHandler|WARN|Failed releasing lock: ${err.body}`
          );
          return TransientFailure.encode({
            kind: "TRANSIENT"
          });
        })
      )
      .fold<FailedBonusActivationResult>(
        l => l,
        () => FailedBonusActivationSuccess.encode({ kind: "SUCCESS" })
      )
      .map(result => {
        // this condition address the case we want the activity to throw, so the orchestrator can retry
        if (TransientFailure.decode(result).isRight()) {
          throw result;
        }
        return result;
      })
      .run();
  };
}
