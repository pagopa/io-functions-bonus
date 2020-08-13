import { Context } from "@azure/functions";
import { array } from "fp-ts/lib/Array";
import { fromEither, taskEither, TaskEither } from "fp-ts/lib/TaskEither";
import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationStatusEnum } from "../generated/definitions/BonusActivationStatus";
import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import {
  BonusActivationModel,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import {
  NewUserBonus,
  RetrievedUserBonus,
  UserBonusModel
} from "../models/user_bonus";
import {
  cosmosErrorsToReadableMessage,
  TransientFailure
} from "../utils/errors";

export const SuccessBonusActivationInput = t.interface({
  bonusActivation: BonusActivationWithFamilyUID
});

export const SuccessBonusActivationSuccess = t.interface({
  kind: t.literal("SUCCESS")
});
export type SuccessBonusActivationSuccess = t.TypeOf<
  typeof SuccessBonusActivationSuccess
>;

export const InvalidInputFailure = t.interface({
  kind: t.literal("INVALID_INPUT")
});
export type InvalidInputFailure = t.TypeOf<typeof InvalidInputFailure>;

const SuccessBonusActivationFailure = t.union(
  [InvalidInputFailure, TransientFailure],
  "SuccessBonusActivationFailure"
);
export type SuccessBonusActivationFailure = t.TypeOf<
  typeof SuccessBonusActivationFailure
>;

export const SuccessBonusActivationResult = t.taggedUnion("kind", [
  SuccessBonusActivationSuccess,
  SuccessBonusActivationFailure
]);
export type SuccessBonusActivationResult = t.TypeOf<
  typeof SuccessBonusActivationResult
>;

const updateBonusAsActive = (
  bonusActivationModel: BonusActivationModel,
  bonusActivation: BonusActivationWithFamilyUID
): TaskEither<CosmosErrors, RetrievedBonusActivation> => {
  const bonusToUpdate: BonusActivationWithFamilyUID = {
    ...bonusActivation,
    status: BonusActivationStatusEnum.ACTIVE
  };
  return bonusActivationModel.replace(bonusToUpdate);
};

const saveBonusForEachFamilyMember = (
  userBonusModel: UserBonusModel,
  {
    applicantFiscalCode,
    id: bonusId,
    dsuRequest: { familyMembers }
  }: BonusActivationWithFamilyUID
): TaskEither<CosmosErrors, readonly RetrievedUserBonus[]> =>
  array.sequence(taskEither)(
    familyMembers
      .map<NewUserBonus>(({ fiscalCode }) => ({
        bonusId,
        fiscalCode,
        id: `${bonusId}-${fiscalCode}` as NonEmptyString,
        isApplicant: applicantFiscalCode === fiscalCode,
        kind: "INewUserBonus"
      }))
      .map(newUserBonus => userBonusModel.upsert(newUserBonus))
  );

type ISuccessBonusActivationHandler = (
  context: Context,
  input: unknown
) => Promise<SuccessBonusActivationResult>;
/**
 * Operations to be perfomed in case the bonus request was accepted by ADE
 *
 *
 * @returns either a success or a failure request
 * @throws when the response is considered a transient failure and thus is not considered a domain message
 */
export function SuccessBonusActivationHandler(
  bonusActivationModel: BonusActivationModel,
  userBonusModel: UserBonusModel
): ISuccessBonusActivationHandler {
  return async (
    context: Context,
    input: unknown
  ): Promise<SuccessBonusActivationResult> => {
    return fromEither(
      SuccessBonusActivationInput.decode(input)
        .mapLeft<SuccessBonusActivationFailure>(() =>
          InvalidInputFailure.encode({ kind: "INVALID_INPUT" })
        )
        .map(({ bonusActivation }) => bonusActivation)
    )
      .chain(bonusActivation =>
        updateBonusAsActive(bonusActivationModel, bonusActivation)
          .mapLeft(cosmosErrorsToReadableMessage)
          .mapLeft(errMessage => {
            context.log.warn(
              `FailedBonusActivationHandler|WARN|Failed updating bonus: ${errMessage}`
            );
            return TransientFailure.encode({
              kind: "TRANSIENT",
              reason: errMessage
            });
          })
      )
      .chain(bonusActivation =>
        saveBonusForEachFamilyMember(userBonusModel, bonusActivation)
          .mapLeft(cosmosErrorsToReadableMessage)
          .mapLeft(errMessage => {
            context.log.warn(
              `FailedBonusActivationHandler|WARN|Failed saving user bonus: ${errMessage}`
            );
            return TransientFailure.encode({
              kind: "TRANSIENT",
              reason: errMessage
            });
          })
      )
      .fold<SuccessBonusActivationResult>(
        l => l,
        () => SuccessBonusActivationSuccess.encode({ kind: "SUCCESS" })
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
