import { Context } from "@azure/functions";
import { fromLeft, TaskEither, taskEither } from "fp-ts/lib/TaskEither";
import { fromEither } from "fp-ts/lib/TaskEither";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { BonusCode } from "../generated/models/BonusCode";
import {
  BonusActivationModel,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import { EligibilityCheckModel } from "../models/eligibility_check";
import {
  cosmosErrorsToReadableMessage,
  TransientFailure
} from "../utils/errors";

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

const updateBonusAsFailed = (
  bonusActivationModel: BonusActivationModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<CosmosErrors, RetrievedBonusActivation> => {
  const bonusToUpdate: BonusActivationWithFamilyUID = {
    ...bonusActivation,
    status: BonusActivationStatusEnum.FAILED
  };
  return bonusActivationModel.replace(bonusToUpdate);
};

const deleteEligibilityCheck = (
  eligibilityCheckModel: EligibilityCheckModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<CosmosErrors, string> =>
  eligibilityCheckModel.deleteOneById(
    bonusActivation.id as BonusCode & NonEmptyString
  );

/**
 * Operations to be perfomed in case the bonus request was rejected by ADE
 *
 *
 * @returns either a success or a failure request
 * @throws when the response is considered a transient failure and thus is not considered a domain message
 */
export function FailedBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
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
          .mapLeft<FailedBonusActivationFailure>(() =>
            InvalidInputFailure.encode({ kind: "INVALID_INPUT" })
          )
          .map(({ bonusActivation }) => bonusActivation)
      )
      .chain(bonusActivation =>
        deleteEligibilityCheck(eligibilityCheckModel, bonusActivation)
          // just ignore this error
          .foldTaskEither(
            err => {
              context.log.warn(
                `FailedBonusActivationHandler|WARN|Failed deleting dsu: ${cosmosErrorsToReadableMessage(
                  err
                )}`
              );
              if (
                err.kind !== "COSMOS_ERROR_RESPONSE" ||
                err.error.code !== 404
              ) {
                return fromLeft<
                  FailedBonusActivationFailure,
                  BonusActivationWithFamilyUID
                >(
                  TransientFailure.encode({
                    kind: "TRANSIENT",
                    reason: `Query Error: ${cosmosErrorsToReadableMessage(err)}`
                  })
                );
              }
              return taskEither.of(bonusActivation);
            },
            _ => taskEither.of(bonusActivation)
          )
      )
      .chain(bonusActivation =>
        updateBonusAsFailed(bonusActivationModel, bonusActivation)
          .mapLeft(cosmosErrorsToReadableMessage)
          // just ignore this error
          .foldTaskEither(
            errorMessage => {
              context.log.warn(
                `FailedBonusActivationHandler|WARN|Failed updating bonus: ${errorMessage}`
              );
              return fromLeft(
                TransientFailure.encode({
                  kind: "TRANSIENT",
                  reason: `Query Error: ${errorMessage}`
                })
              );
            },
            _ => taskEither.of(bonusActivation)
          )
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
