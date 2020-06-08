// tslint:disable: no-duplicate-string

import { isLeft, isRight } from "fp-ts/lib/Either";
import { EligibilityCheck as ApiEligibilityCheck } from "../../generated/definitions/EligibilityCheck";

import {
  toApiBonusActivation,
  toApiEligibilityCheck,
  toModelBonusActivation,
  toModelEligibilityCheck
} from "../conversions";

import { BonusActivation as ApiBonusActivation } from "../../generated/definitions/BonusActivation";
import { BonusActivation } from "../../generated/models/BonusActivation";
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

import { IWithinRangeIntegerTag } from "italia-ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivationStatusEnum as ApiBonusActivationStatusEnum } from "../../generated/definitions/BonusActivationStatus";
import { MaxBonusAmount } from "../../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../../generated/definitions/MaxBonusTaxBenefit";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";

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

const aBonusActivationDomainObject: BonusActivation = {
  id: "aBonusActivationId" as NonEmptyString,

  applicantFiscalCode: aFiscalCode,

  status: BonusActivationStatusEnum.ACTIVE,

  code: "a bonus code" as NonEmptyString,

  updatedAt: new Date(),

  dsuRequest: {
    id: (aFiscalCode as unknown) as NonEmptyString,

    status: EligibilityCheckSuccessEligibleStatusEnum.ELIGIBLE,

    familyMembers: [
      {
        fiscalCode: aFiscalCode,
        name: "MARIO" as NonEmptyString,
        surname: "ROSSI" as NonEmptyString
      }
    ],

    maxAmount: (200 as unknown) as IWithinRangeIntegerTag<150, 501> & number,

    maxTaxBenefit: (100 as unknown) as IWithinRangeIntegerTag<30, 101> & number,

    validBefore: new Date(),

    requestId: "aRequestId" as NonEmptyString,

    iseeType: "aISEEtype",

    dsuProtocolId: "aProtocolId" as NonEmptyString,

    dsuCreatedAt: new Date().toISOString(),

    hasDiscrepancies: false
  }
};

const aBonusActivationApiObject: ApiBonusActivation = {
  id: "aBonusActivationId" as NonEmptyString,

  applicant_fiscal_code: aFiscalCode,

  status: ApiBonusActivationStatusEnum.ACTIVE,

  code: "a bonus code" as NonEmptyString,

  updated_at: new Date(),

  dsu_request: {
    id: (aFiscalCode as unknown) as NonEmptyString,

    status: ApiEligibilityCheckSuccessEligibleEnum.ELIGIBLE,

    family_members: [
      {
        fiscal_code: aFiscalCode,
        name: "MARIO" as NonEmptyString,
        surname: "ROSSI" as NonEmptyString
      }
    ],

    max_amount: (200 as unknown) as IWithinRangeIntegerTag<150, 501> & number,

    max_tax_benefit: (100 as unknown) as IWithinRangeIntegerTag<30, 101> &
      number,

    valid_before: new Date(),

    request_id: "aRequestId" as NonEmptyString,

    isee_type: "aISEEtype",

    dsu_protocol_id: "aProtocolId" as NonEmptyString,

    dsu_created_at: new Date().toISOString(),

    has_discrepancies: false
  }
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

describe("ModelBonusActivationFromApi", () => {
  it("should not decode an invalid api object", () => {
    const apiObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = toModelBonusActivation(apiObject);
    expect(isLeft(result)).toBeTruthy();
  });

  it("should decode api object", () => {
    const apiObject = aBonusActivationApiObject;
    const result = toModelBonusActivation(apiObject);
    if (isRight(result)) {
      expect(BonusActivation.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it("should reverse on api object", () => {
    const apiObject = aBonusActivationApiObject;
    toModelBonusActivation(apiObject)
      .chain(obj => toApiBonusActivation(obj))
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

describe("ApiBonusActivationFromModel", () => {
  it("should not decode an invalid domain object", () => {
    const invalidDomainObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = toApiBonusActivation(invalidDomainObject);
    expect(isLeft(result)).toBeTruthy();
  });

  it("should decode domain", () => {
    const domainObject = aBonusActivationDomainObject;
    const result = toApiBonusActivation(domainObject);
    if (isRight(result)) {
      expect(ApiBonusActivation.is(result.value)).toBeTruthy();
    } else {
      fail("Valid domain object must be decoded");
    }
  });

  it("should reverse on domain object", () => {
    const domainObject = aBonusActivationDomainObject;
    toApiBonusActivation(domainObject)
      .chain(obj => toModelBonusActivation(obj))
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
