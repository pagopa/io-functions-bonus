// tslint:disable: no-duplicate-string

import { isLeft, isRight } from "fp-ts/lib/Either";
import { EligibilityCheck as ApiEligibilityCheck } from "../../generated/definitions/EligibilityCheck";

import { toApiEligibilityCheck, toModelEligibilityCheck } from "../conversions";

import {
  EligibilityCheckFailure,
  ErrorEnum as EligibilityCheckFailureErrorEnum
} from "../../generated/models/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibilityCheckSuccessEligibleStatusEnum
} from "../../generated/models/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as EligibilityCheckSuccessIneligibleStatusEnum
} from "../../generated/models/EligibilityCheckSuccessIneligible";

import {
  EligibilityCheckFailure as ApiEligibilityCheckFailure,
  ErrorEnum as ApiEligibilityCheckFailureErrorEnum
} from "../../generated/definitions/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible as ApiEligibilityCheckSuccessEligible,
  StatusEnum as ApiEligibilityCheckSuccessEligibleEnum
} from "../../generated/definitions/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible as ApiEligibilityCheckSuccessIneligible,
  StatusEnum as EligibilityCheckSuccessIneligibleEnumApi
} from "../../generated/definitions/EligibilityCheckSuccessIneligible";
import { EligibilityCheck } from "../../generated/models/EligibilityCheck";

import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { MaxBonusAmount } from "../../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../../generated/definitions/MaxBonusTaxBenefit";

const aFiscalCode = "SPNDNL80R13C523K" as FiscalCode;

//// Api objects

const anElibigleApiObject: ApiEligibilityCheckSuccessEligible = {
  family_members: [
    {
      fiscal_code: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  id: (aFiscalCode as unknown) as NonEmptyString,
  max_amount: 200 as MaxBonusAmount,
  max_tax_benefit: 50 as MaxBonusTaxBenefit,
  status: ApiEligibilityCheckSuccessEligibleEnum.ELIGIBLE,
  valid_before: new Date()
};

const anInelibigleApiObject: ApiEligibilityCheckSuccessIneligible = {
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessIneligibleEnumApi.INELIGIBLE
};

const aFailureApiObject: ApiEligibilityCheckFailure = {
  error: ApiEligibilityCheckFailureErrorEnum.INTERNAL_ERROR,
  error_description: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString
};

//// Domain objects

const anEligibleDomainObject: EligibilityCheckSuccessEligible = {
  familyMembers: [
    {
      fiscalCode: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  id: (aFiscalCode as unknown) as NonEmptyString,
  maxAmount: 200 as MaxBonusAmount,
  maxTaxBenefit: 50 as MaxBonusTaxBenefit,
  status: EligibilityCheckSuccessEligibleStatusEnum.ELIGIBLE,
  validBefore: new Date()
};

const anIneligibleDomainObject: EligibilityCheckSuccessIneligible = {
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessIneligibleStatusEnum.INELIGIBLE
};

const aFailureDomainObject: EligibilityCheckFailure = {
  error: EligibilityCheckFailureErrorEnum.INTERNAL_ERROR,
  errorDescription: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString
};

describe("ModelEligibilityCheckFromApi", () => {
  it("should not decode an invalid api object", () => {
    const apiObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = toModelEligibilityCheck(apiObject);
    expect(isLeft(result)).toBeTruthy();
  });

  it.each`
    name                       | apiObject
    ${"failure api object"}    | ${aFailureApiObject}
    ${"eligible api object"}   | ${anElibigleApiObject}
    ${"ineligible api object"} | ${anInelibigleApiObject}
  `("should decode $name", ({ apiObject }) => {
    const result = toModelEligibilityCheck(apiObject);
    if (isRight(result)) {
      expect(EligibilityCheck.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it.each`
    name                       | apiObject
    ${"failure api object"}    | ${aFailureApiObject}
    ${"eligible api object"}   | ${anElibigleApiObject}
    ${"ineligible api object"} | ${anInelibigleApiObject}
  `("should reverse on $name", ({ apiObject }) => {
    toModelEligibilityCheck(apiObject)
      .chain(obj => toApiEligibilityCheck(obj))
      .fold(
        _ => {
          fail("Valid api object must be decoded");
        },
        value => {
          expect(value).toEqual(apiObject);
        }
      );
  });
});

describe("ApiEligibilityCheckFromModel", () => {
  it("should not decode an invalid domain object", () => {
    const invalidDomainObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = toApiEligibilityCheck(invalidDomainObject);
    expect(isLeft(result)).toBeTruthy();
  });

  it.each`
    name                          | domainObject
    ${"failure domain object"}    | ${aFailureDomainObject}
    ${"eligible domain object"}   | ${anEligibleDomainObject}
    ${"ineligible domain object"} | ${anIneligibleDomainObject}
  `("should decode $name", ({ domainObject }) => {
    const result = toApiEligibilityCheck(domainObject);
    if (isRight(result)) {
      expect(ApiEligibilityCheck.is(result.value)).toBeTruthy();
    } else {
      fail("Valid domain object must be decoded");
    }
  });

  it.each`
    name                          | domainObject
    ${"failure domain object"}    | ${aFailureDomainObject}
    ${"eligible domain object"}   | ${anEligibleDomainObject}
    ${"ineligible domain object"} | ${anIneligibleDomainObject}
  `("should reverse on $name", ({ domainObject }) => {
    toApiEligibilityCheck(domainObject)
      .chain(obj => toModelEligibilityCheck(obj))
      .fold(
        _ => {
          fail("Valid domain object must be decoded");
        },
        value => {
          expect(value).toEqual(domainObject);
        }
      );
  });
});
