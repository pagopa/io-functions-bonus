// tslint:disable: no-duplicate-string

import { isLeft, isRight } from "fp-ts/lib/Either";
import { EligibilityCheck as ApiEligibilityCheck } from "../../generated/definitions/EligibilityCheck";

import {
  toApiBonusActivation,
  toApiBonusVacanzaBase,
  toApiEligibilityCheck,
  toModelBonusActivation,
  toModelEligibilityCheck
} from "../conversions";

import { BonusActivation as ApiBonusActivation } from "../../generated/definitions/BonusActivation";
import { BonusActivationWithFamilyUID } from "../../generated/models/BonusActivationWithFamilyUID";
import {
  EligibilityCheckFailure,
  ErrorEnum as EligibilityCheckFailureErrorEnum,
  StatusEnum as EligibilityCheckFailureStatusEnum
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
  ErrorEnum as ApiEligibilityCheckFailureErrorEnum,
  StatusEnum as ErrorStatusEnum
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
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusVacanzaBase as ApiBonusVacanzaBase } from "../../generated/ade/BonusVacanzaBase";
import { BonusActivationStatusEnum as ApiBonusActivationStatusEnum } from "../../generated/definitions/BonusActivationStatus";
import { BonusCode as BonusCodeApi } from "../../generated/definitions/BonusCode";
import { MaxBonusAmount } from "../../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../../generated/definitions/MaxBonusTaxBenefit";
import { BonusActivationStatusEnum } from "../../generated/models/BonusActivationStatus";
import { BonusCode as BonusCodeModel } from "../../generated/models/BonusCode";
import { FamilyMember } from "../../generated/models/FamilyMember";
import { generateFamilyUID } from "../hash";

const aFiscalCode = "SPNDNL80R13C523K" as FiscalCode;

//// Api objects

const anElibigleApiObject: ApiEligibilityCheckSuccessEligible = {
  dsu_request: {
    dsu_created_at: new Date(),
    dsu_protocol_id: "123" as NonEmptyString,
    family_members: [
      {
        fiscal_code: aFiscalCode,
        name: "Mario" as NonEmptyString,
        surname: "Rossi" as NonEmptyString
      }
    ],
    has_discrepancies: true,
    isee_type: "some isee type" as NonEmptyString,
    max_amount: 200 as MaxBonusAmount,
    max_tax_benefit: 50 as MaxBonusTaxBenefit,
    request_id: "123" as NonEmptyString
  },
  id: (aFiscalCode as unknown) as NonEmptyString,
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
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: "FAILURE" as ErrorStatusEnum
};

//// Domain objects

const anEligibleDomainObject: EligibilityCheckSuccessEligible = {
  dsuRequest: {
    dsuCreatedAt: new Date(),
    dsuProtocolId: "123" as NonEmptyString,
    familyMembers: [
      {
        fiscalCode: aFiscalCode,
        name: "Mario" as NonEmptyString,
        surname: "Rossi" as NonEmptyString
      }
    ],
    hasDiscrepancies: true,
    iseeType: "some isee type",
    maxAmount: 200 as MaxBonusAmount,
    maxTaxBenefit: 50 as MaxBonusTaxBenefit,
    requestId: "123" as NonEmptyString
  },
  id: (aFiscalCode as unknown) as NonEmptyString,
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
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckFailureStatusEnum.FAILURE
};

const familyMembers: ReadonlyArray<FamilyMember> = [
  {
    fiscalCode: aFiscalCode,
    name: "MARIO" as NonEmptyString,
    surname: "ROSSI" as NonEmptyString
  }
];

const aBonusActivationDomainObject: BonusActivationWithFamilyUID = {
  id: "AAAAAAAAAAAA" as BonusCodeModel,

  applicantFiscalCode: aFiscalCode,

  status: BonusActivationStatusEnum.ACTIVE,

  createdAt: new Date(),

  dsuRequest: {
    familyMembers,

    maxAmount: (200 as unknown) as IWithinRangeIntegerTag<150, 501> & number,

    maxTaxBenefit: (100 as unknown) as IWithinRangeIntegerTag<30, 101> & number,

    requestId: "aRequestId" as NonEmptyString,

    iseeType: "aISEEtype",

    dsuProtocolId: "aProtocolId" as NonEmptyString,

    dsuCreatedAt: new Date(),

    hasDiscrepancies: false
  },
  familyUID: generateFamilyUID(familyMembers)
};

const aBonusActivationApiObject: ApiBonusActivation = {
  id: "AAAAAAAAAAAA" as BonusCodeApi,

  applicant_fiscal_code: aFiscalCode,

  status: ApiBonusActivationStatusEnum.ACTIVE,

  created_at: new Date(),

  dsu_request: {
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

    request_id: "aRequestId" as NonEmptyString,

    isee_type: "aISEEtype",

    dsu_protocol_id: "aProtocolId" as NonEmptyString,

    dsu_created_at: new Date(),

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
      expect(BonusActivationWithFamilyUID.is(result.value)).toBeTruthy();
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

describe("ApiBonusVacanzaBaseFromModel", () => {
  it("should decode domain", () => {
    const domainObject = aBonusActivationDomainObject;
    const result = toApiBonusVacanzaBase(domainObject);
    if (isRight(result)) {
      expect(ApiBonusVacanzaBase.is(result.value)).toBeTruthy();
    } else {
      fail(
        `Valid domain object must be decoded: ${readableReport(result.value)}`
      );
    }
  });
});
