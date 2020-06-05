/**
 * Collection of Codecs to convert EligibleCheck domain object into compatible formats
 */

import { either } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { EligibilityCheck as EligibilityCheckApi } from "../../generated/definitions/EligibilityCheck";
import { ErrorEnum as EligibilityCheckErrorEnumApi } from "../../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccess as EligibilityCheckSuccessApi } from "../../generated/definitions/EligibilityCheckSuccess";
import {
  EligibilityCheck,
  EligibilityCheckErrorEnum,
  EligibilityCheckSuccess
} from "../../types/EligibilityCheck";

/**
 * Utility to perform exhaustive checks. It behaves as an identity function
 * @param input the value to be checked
 * @param retValue optional, if valued overrides the returned value
 *
 * @returns the passed value if not overridden, the override otherwise
 */
const unhandledValue = (input: never, retValue = input) => retValue;

/**
 * Maps EligibilityCheck api object into a EligibilityCheck domain object
 */
export const EligibilityCheckFromApiObject = new t.Type<
  EligibilityCheck,
  EligibilityCheck,
  EligibilityCheckApi
>(
  "EligibilityCheckFromApiObject",
  EligibilityCheck.is,
  (apiObject: EligibilityCheckApi, c) => {
    try {
      const fromApiObject: EligibilityCheck = {
        id: apiObject.id,
        ...(EligibilityCheckSuccessApi.is(apiObject)
          ? {
              familyMembers: apiObject.family_members.map(fm => ({
                fiscalCode: fm.fiscal_code,
                name: fm.name,
                surname: fm.surname
              })),
              maxAmount: apiObject.max_amount,
              maxTaxBenefit: apiObject.max_tax_benefit,
              status: apiObject.status
            }
          : {
              error:
                apiObject.error === EligibilityCheckErrorEnumApi.DATA_NOT_FOUND
                  ? EligibilityCheckErrorEnum.DATA_NOT_FOUND
                  : apiObject.error ===
                    EligibilityCheckErrorEnumApi.INTERNAL_ERROR
                  ? EligibilityCheckErrorEnum.INTERNAL_ERROR
                  : apiObject.error ===
                    EligibilityCheckErrorEnumApi.INVALID_REQUEST
                  ? EligibilityCheckErrorEnum.INVALID_REQUEST
                  : unhandledValue(apiObject.error),
              errorDescription: apiObject.error_description
            })
      };
      return either.chain(
        EligibilityCheck.validate(fromApiObject, c),
        domainObject => t.success(domainObject)
      );
    } catch (error) {
      return t.failure(apiObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheck domain object into a EligibilityCheck api object
 */
export const EligibilityCheckToApiObject = new t.Type<
  EligibilityCheckApi,
  EligibilityCheckApi,
  EligibilityCheck
>(
  "EligibilityCheckToApiObject",
  EligibilityCheckApi.is,
  (domainObject, c) => {
    try {
      const fromDomainObject: EligibilityCheckApi = {
        id: domainObject.id,
        ...(EligibilityCheckSuccess.is(domainObject)
          ? {
              family_members: domainObject.familyMembers.map(fm => ({
                fiscal_code: fm.fiscalCode,
                name: fm.name,
                surname: fm.surname
              })),
              max_amount: domainObject.maxAmount,
              max_tax_benefit: domainObject.maxTaxBenefit,
              status: domainObject.status
            }
          : {
              error:
                domainObject.error === EligibilityCheckErrorEnum.DATA_NOT_FOUND
                  ? EligibilityCheckErrorEnumApi.DATA_NOT_FOUND
                  : domainObject.error ===
                    EligibilityCheckErrorEnum.INTERNAL_ERROR
                  ? EligibilityCheckErrorEnumApi.INTERNAL_ERROR
                  : domainObject.error ===
                    EligibilityCheckErrorEnum.INVALID_REQUEST
                  ? EligibilityCheckErrorEnumApi.INVALID_REQUEST
                  : unhandledValue(domainObject.error),
              error_description: domainObject.errorDescription
            })
      };
      return either.chain(
        EligibilityCheckApi.validate(fromDomainObject, c),
        apiObject => t.success(apiObject)
      );
    } catch (error) {
      return t.failure(domainObject, c);
    }
  },
  e => e
);
