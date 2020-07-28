import { Context } from "@azure/functions";
import { left, right } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { StatusEnum as ConflictStatusEnum } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { StatusEnum as EligibleStatusEnum } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { BonusLeaseModel } from "../models/bonus_lease";
import { cosmosErrorsToReadableMessage } from "../utils/errors";
import { generateFamilyUID } from "../utils/hash";

export const ValidateEligibilityCheckActivityInput = ApiEligibilityCheck;
export type ValidateEligibilityCheckActivityInput = t.TypeOf<
  typeof ValidateEligibilityCheckActivityInput
>;

export const ValidateEligibilityCheckActivityOutput = ApiEligibilityCheck;
export type ValidateEligibilityCheckActivityOutput = t.TypeOf<
  typeof ValidateEligibilityCheckActivityOutput
>;

type IValidateEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<ValidateEligibilityCheckActivityOutput>;

/**
 * Check if there's still an ACTIVE / PROCESSING bonus
 * for the members of the family returned by the ISEE (DSU) request.
 *
 * In case it exists, the status of the ApiEligibilityCheck is updated to CONFLICT
 * otherwise we return the unchanged object.
 */
export function getValidateEligibilityCheckActivityHandler(
  bonusLeaseModel: BonusLeaseModel
): IValidateEligibilityCheckHandler {
  return (context, input) => {
    return fromEither(
      ValidateEligibilityCheckActivityInput.decode(input).mapLeft(
        err => new Error(`Decoding Error: [${readableReport(err)}]`)
      )
    )
      .chain(eligibilityCheck => {
        if (eligibilityCheck.status !== EligibleStatusEnum.ELIGIBLE) {
          return fromEither(right(eligibilityCheck));
        }
        const familyUID = generateFamilyUID(
          eligibilityCheck.dsu_request.family_members.map(familyMember => ({
            fiscalCode: familyMember.fiscal_code,
            name: familyMember.name,
            surname: familyMember.surname
          }))
        );
        return bonusLeaseModel
          .find(familyUID, familyUID)
          .foldTaskEither<Error, ValidateEligibilityCheckActivityOutput>(
            error =>
              fromEither(
                left(
                  new Error(
                    `Query Error: code=[${cosmosErrorsToReadableMessage(
                      error
                    )}]`
                  )
                )
              ),
            bonusLease => {
              if (isNone(bonusLease)) {
                return taskEither.of(eligibilityCheck);
              }
              return taskEither.of({
                ...eligibilityCheck,
                status: ConflictStatusEnum.CONFLICT
              });
            }
          );
      })
      .fold(
        error => {
          context.log.error("ValidateEligibilityCheckActivity|ERROR|%s", error);
          throw error;
        },
        validatedEligibilityCheck => validatedEligibilityCheck
      )
      .run();
  };
}
