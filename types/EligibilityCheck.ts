import * as t from "io-ts";
import { WithinRangeInteger } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { enumType } from "italia-ts-commons/lib/types";
import { FamilyMember } from "./FamilyMember";

export enum EligibilityCheckErrorEnum {
  "INVALID_REQUEST",
  "INTERNAL_ERROR",
  "DATA_NOT_FOUND"
}
export type EligibilityCheckError = t.TypeOf<typeof EligibilityCheckError>;
export const EligibilityCheckError = enumType<EligibilityCheckErrorEnum>(
  EligibilityCheckErrorEnum,
  "EligibilityCheckStatus"
);

export enum EligibilityCheckStatusEnum {
  "ELIGIBLE",
  "INELIGIBLE"
}
export type EligibilityCheckStatus = t.TypeOf<typeof EligibilityCheckStatus>;
export const EligibilityCheckStatus = enumType<EligibilityCheckStatusEnum>(
  EligibilityCheckStatusEnum,
  "EligibilityCheckStatus"
);

export type EligibilityCheckSuccess = t.TypeOf<typeof EligibilityCheckSuccess>;
export const EligibilityCheckSuccess = t.exact(
  t.intersection(
    [
      t.interface({
        familyMembers: t.readonlyArray(FamilyMember),
        id: NonEmptyString,
        status: EligibilityCheckStatus
      }),
      t.partial({
        maxAmount: WithinRangeInteger(0, 50000),
        maxTaxBenefit: WithinRangeInteger(0, 50000)
      })
    ],
    "EligibilityCheckSuccess"
  )
);

export type EligibilityCheckFailure = t.TypeOf<typeof EligibilityCheckFailure>;
export const EligibilityCheckFailure = t.interface({
  error: EligibilityCheckError,
  errorDescription: t.string,
  id: NonEmptyString
});

export type EligibilityCheck = t.TypeOf<typeof EligibilityCheck>;
export const EligibilityCheck = t.union(
  [EligibilityCheckSuccess, EligibilityCheckFailure],
  "EligibilityCheck"
);
