import { Context } from "@azure/functions";
import { left, right } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import { fromEither, tryCatch } from "fp-ts/lib/TaskEither";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { EligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { StatusEnum as ConflictStatusEnum } from "../generated/definitions/EligibilityCheckSuccessConflict";
import { StatusEnum as EligibleStatusEnum } from "../generated/definitions/EligibilityCheckSuccessEligible";
import { BonusLeaseModel } from "../models/bonus_lease";
import { generateFamilyUID } from "../utils/hash";

type IValidateEligibilityCheckHandler = (
  context: Context,
  input: unknown
) => Promise<EligibilityCheck>;

export function getValidateEligibilityCheckActivityHandler(
  bonusLeaseModel: BonusLeaseModel
): IValidateEligibilityCheckHandler {
  return (_, input) => {
    return fromEither(
      EligibilityCheck.decode(input).mapLeft(
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
        return tryCatch(
          () => bonusLeaseModel.find(familyUID, familyUID),
          () => new Error("Error calling bonusLeaseModel.find")
        ).foldTaskEither<Error, EligibilityCheck>(
          error => fromEither(left(error)),
          queryResult =>
            fromEither(
              queryResult
                .mapLeft(
                  queryError =>
                    new Error(`Query Error: code=[${queryError.code}]`)
                )
                .map(bonusLease => {
                  if (isNone(bonusLease)) {
                    return eligibilityCheck;
                  }
                  return {
                    ...eligibilityCheck,
                    status: ConflictStatusEnum.CONFLICT
                  };
                })
            )
        );
      })
      .fold(
        error => {
          throw error;
        },
        validatedEligibilityCheck => validatedEligibilityCheck
      )
      .run();
  };
}
