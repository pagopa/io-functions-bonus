/**
 * Collection of Codecs to convert EligibleCheck domain object into compatible formats
 */

import { either } from "fp-ts/lib/Either";
import * as t from "io-ts";

import {
  EligibilityCheckSuccessEligible as ApiEligibilityCheckSuccessEligible,
  StatusEnum as ApiEligibilityCheckSuccessEligibleStatusEnum
} from "../../generated/definitions/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibilityCheckSuccessEligibleStatusEnum
} from "../../generated/models/EligibilityCheckSuccessEligible";

import {
  EligibilityCheckSuccessIneligible as ApiEligibilityCheckSuccessIneligible,
  StatusEnum as ApiEligibilityCheckSuccessIneligibleStatusEnum
} from "../../generated/definitions/EligibilityCheckSuccessIneligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as EligibilityCheckSuccessIneligibleStatusEnum
} from "../../generated/models/EligibilityCheckSuccessIneligible";

import {
  EligibilityCheckFailure as ApiEligibilityCheckFailure,
  ErrorEnum as ApiEligibilityCheckFailureErrorEnum
} from "../../generated/definitions/EligibilityCheckFailure";
import {
  EligibilityCheckFailure,
  ErrorEnum as EligibilityCheckFailureErrorEnum
} from "../../generated/models/EligibilityCheckFailure";

import { EligibilityCheck as ApiEligibilityCheck } from "../../generated/definitions/EligibilityCheck";
import { EligibilityCheck } from "../../generated/models/EligibilityCheck";
import { assertNever, unhandledValue } from "../types";

/**
 * Maps EligibilityCheck api object into a EligibilityCheck domain object
 */
const ModelEligibilityCheckSuccessEligibleFromApi = new t.Type<
  EligibilityCheckSuccessEligible,
  EligibilityCheckSuccessEligible,
  ApiEligibilityCheckSuccessEligible
>(
  "ModelEligibilityCheckSuccessEligibleFromApi",
  EligibilityCheckSuccessEligible.is,
  (apiObject: ApiEligibilityCheckSuccessEligible, c) => {
    try {
      const fromApiObject: EligibilityCheckSuccessEligible = {
        familyMembers: apiObject.family_members.map(fm => ({
          fiscalCode: fm.fiscal_code,
          name: fm.name,
          surname: fm.surname
        })),
        id: apiObject.id,
        maxAmount: apiObject.max_amount,
        maxTaxBenefit: apiObject.max_tax_benefit,
        status: EligibilityCheckSuccessEligibleStatusEnum.ELIGIBLE,
        validBefore: apiObject.valid_before
      };
      return either.chain(
        EligibilityCheckSuccessEligible.validate(fromApiObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(apiObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheckSuccessEligible domain object into a EligibilityCheckSuccessEligible api object
 */
const ApiEligibilityCheckSuccessEligibleFromModel = new t.Type<
  ApiEligibilityCheckSuccessEligible,
  ApiEligibilityCheckSuccessEligible,
  EligibilityCheckSuccessEligible
>(
  "ApiEligibilityCheckSuccessEligibleFromModel",
  ApiEligibilityCheckSuccessEligible.is,
  (domainObject, c) => {
    try {
      const fromDomainObject: ApiEligibilityCheckSuccessEligible = {
        family_members: domainObject.familyMembers.map(fm => ({
          fiscal_code: fm.fiscalCode,
          name: fm.name,
          surname: fm.surname
        })),
        id: domainObject.id,
        max_amount: domainObject.maxAmount,
        max_tax_benefit: domainObject.maxTaxBenefit,
        status: ApiEligibilityCheckSuccessEligibleStatusEnum.ELIGIBLE,
        valid_before: domainObject.validBefore
      };
      return either.chain(
        ApiEligibilityCheckSuccessEligible.validate(fromDomainObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(domainObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheckSuccessIneligible api object into a EligibilityCheckSuccessIneligible domain object
 */
const ModelEligibilityCheckSuccessIneligibleFromApi = new t.Type<
  EligibilityCheckSuccessIneligible,
  EligibilityCheckSuccessIneligible,
  ApiEligibilityCheckSuccessIneligible
>(
  "ModelEligibilityCheckSuccessIneligibleFromApi",
  EligibilityCheckSuccessIneligible.is,
  (apiObject: ApiEligibilityCheckSuccessIneligible, c) => {
    try {
      const fromApiObject: EligibilityCheckSuccessIneligible = {
        id: apiObject.id,
        status: EligibilityCheckSuccessIneligibleStatusEnum.INELIGIBLE
      };
      return either.chain(
        EligibilityCheckSuccessIneligible.validate(fromApiObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(apiObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheckSuccessIneligible domain object into a EligibilityCheckSuccessIneligible api object
 */
const ApiEligibilityCheckSuccessIneligibleFromModel = new t.Type<
  ApiEligibilityCheckSuccessIneligible,
  ApiEligibilityCheckSuccessIneligible,
  EligibilityCheckSuccessIneligible
>(
  "ApiEligibilityCheckSuccessIneligibleFromModel",
  ApiEligibilityCheckSuccessIneligible.is,
  (domainObject, c) => {
    try {
      const fromDomainObject: ApiEligibilityCheckSuccessIneligible = {
        id: domainObject.id,
        status: ApiEligibilityCheckSuccessIneligibleStatusEnum.INELIGIBLE
      };
      return either.chain(
        ApiEligibilityCheckSuccessIneligible.validate(fromDomainObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(domainObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheckFailure api object into a EligibilityCheckFailure domain object
 */
const ModelEligibilityCheckFailureFromApi = new t.Type<
  EligibilityCheckFailure,
  EligibilityCheckFailure,
  ApiEligibilityCheckFailure
>(
  "ModelEligibilityCheckFailureFromApi",
  EligibilityCheckFailure.is,
  (apiObject: ApiEligibilityCheckFailure, c) => {
    try {
      const fromApiObject: EligibilityCheckFailure = {
        error:
          apiObject.error ===
          ApiEligibilityCheckFailureErrorEnum.DATABASE_OFFLINE
            ? EligibilityCheckFailureErrorEnum.DATABASE_OFFLINE
            : apiObject.error ===
              ApiEligibilityCheckFailureErrorEnum.DATA_NOT_FOUND
            ? EligibilityCheckFailureErrorEnum.DATA_NOT_FOUND
            : apiObject.error ===
              ApiEligibilityCheckFailureErrorEnum.INTERNAL_ERROR
            ? EligibilityCheckFailureErrorEnum.INTERNAL_ERROR
            : apiObject.error ===
              ApiEligibilityCheckFailureErrorEnum.INVALID_REQUEST
            ? EligibilityCheckFailureErrorEnum.INVALID_REQUEST
            : unhandledValue(apiObject.error),
        errorDescription: apiObject.error_description,
        id: apiObject.id
      };
      return either.chain(
        EligibilityCheckFailure.validate(fromApiObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(apiObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheckFailure domain object into a EligibilityCheckFailure api object
 */
const ApiEligibilityCheckFailureFromModel = new t.Type<
  ApiEligibilityCheckFailure,
  ApiEligibilityCheckFailure,
  EligibilityCheckFailure
>(
  "ApiEligibilityCheckFailureFromModel",
  ApiEligibilityCheckFailure.is,
  (domainObject, c) => {
    try {
      const fromDomainObject: ApiEligibilityCheckFailure = {
        error:
          domainObject.error ===
          EligibilityCheckFailureErrorEnum.DATABASE_OFFLINE
            ? ApiEligibilityCheckFailureErrorEnum.DATABASE_OFFLINE
            : domainObject.error ===
              EligibilityCheckFailureErrorEnum.DATA_NOT_FOUND
            ? ApiEligibilityCheckFailureErrorEnum.DATA_NOT_FOUND
            : domainObject.error ===
              EligibilityCheckFailureErrorEnum.INTERNAL_ERROR
            ? ApiEligibilityCheckFailureErrorEnum.INTERNAL_ERROR
            : domainObject.error ===
              EligibilityCheckFailureErrorEnum.INVALID_REQUEST
            ? ApiEligibilityCheckFailureErrorEnum.INVALID_REQUEST
            : unhandledValue(domainObject.error),
        error_description: domainObject.errorDescription,
        id: domainObject.id
      };
      return either.chain(
        ApiEligibilityCheckFailure.validate(fromDomainObject, c),
        decoded => t.success(decoded)
      );
    } catch (error) {
      return t.failure(domainObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheck api object into a EligibilityCheck domain object
 */
export const ModelEligibilityCheckFromApi = new t.Type<
  EligibilityCheck,
  EligibilityCheck,
  ApiEligibilityCheck
>(
  "ModelEligibilityCheckFromApi",
  EligibilityCheck.is,
  (apiObject: ApiEligibilityCheck, c) => {
    try {
      return ApiEligibilityCheckSuccessEligible.is(apiObject)
        ? ModelEligibilityCheckSuccessEligibleFromApi.decode(apiObject)
        : ApiEligibilityCheckSuccessIneligible.is(apiObject)
        ? ModelEligibilityCheckSuccessIneligibleFromApi.decode(apiObject)
        : ApiEligibilityCheckFailure.is(apiObject)
        ? ModelEligibilityCheckFailureFromApi.decode(apiObject)
        : assertNever(apiObject);
    } catch (error) {
      return t.failure(apiObject, c);
    }
  },
  e => e
);

/**
 * Maps EligibilityCheck domain object into a EligibilityCheck api object
 */
export const ApiEligibilityCheckFromModel = new t.Type<
  ApiEligibilityCheck,
  ApiEligibilityCheck,
  EligibilityCheck
>(
  "EligibilityCheckToApiObject",
  ApiEligibilityCheck.is,
  (domainObject, c) => {
    try {
      return EligibilityCheckSuccessEligible.is(domainObject)
        ? ApiEligibilityCheckSuccessEligibleFromModel.decode(domainObject)
        : EligibilityCheckSuccessIneligible.is(domainObject)
        ? ApiEligibilityCheckSuccessIneligibleFromModel.decode(domainObject)
        : EligibilityCheckFailure.is(domainObject)
        ? ApiEligibilityCheckFailureFromModel.decode(domainObject)
        : assertNever(domainObject);
    } catch (error) {
      return t.failure(domainObject, c);
    }
  },
  e => e
);
