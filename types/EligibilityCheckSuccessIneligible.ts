/**
 * Do not edit this file it is auto-generated by italia-utils / gen-api-models.
 * See https://github.com/teamdigitale/italia-utils
 */
/* tslint:disable */

import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { enumType } from "italia-ts-commons/lib/types";

export enum StatusEnum {
  "INELIGIBLE" = "INELIGIBLE"
}

/**
 * Eligibility check succeeded, we can proceed and send the eligibility status.
 * Amounts are left undefined when status is INELIGIBLE
 *
 */

// required attributes
const EligibilityCheckSuccessIneligibleR = t.interface({
  id: NonEmptyString,

  status: enumType<StatusEnum>(StatusEnum, "status")
});

// optional attributes
const EligibilityCheckSuccessIneligibleO = t.partial({});

export const EligibilityCheckSuccessIneligible = t.exact(
  t.intersection(
    [EligibilityCheckSuccessIneligibleR, EligibilityCheckSuccessIneligibleO],
    "EligibilityCheckSuccessIneligible"
  )
);

export type EligibilityCheckSuccessIneligible = t.TypeOf<
  typeof EligibilityCheckSuccessIneligible
>;
