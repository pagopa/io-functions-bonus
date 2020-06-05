// tslint:disable: no-duplicate-string

import { isRight } from "fp-ts/lib/Either";
import { EligibilityCheck as EligibilityCheckApi } from "../../../generated/definitions/EligibilityCheck";
import {
  EligibilityCheckFailure as EligibilityCheckFailureApi,
  ErrorEnum as EligibilityCheckFailureErrorEnumApi
} from "../../../generated/definitions/EligibilityCheckFailure";
import { EligibilityCheckSuccess as EligibilityCheckSuccessApi } from "../../../generated/definitions/EligibilityCheckSuccess";
import {
  EligibilityCheck,
  EligibilityCheckErrorEnum,
  EligibilityCheckFailure,
  EligibilityCheckSuccess
} from "../../../types/EligibilityCheck";
import {
  EligibilityCheckFromApiObject,
  EligibilityCheckToApiObject
} from "../eligibility_check_codecs";

import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { EligibilityCheckStatusEnum as EligibilityCheckStatusEnumApi } from "../../../generated/definitions/EligibilityCheckStatus";

const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

const aSuccessApiObject: EligibilityCheckSuccessApi = {
  family_members: [
    {
      fiscal_code: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckStatusEnumApi.ELIGIBLE
};

const aFailureApiObject: EligibilityCheckFailureApi = {
  error: EligibilityCheckFailureErrorEnumApi.INTERNAL_ERROR,
  error_description: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString
};

const aSuccessDomainObject: EligibilityCheckSuccess = {
  familyMembers: [
    {
      fiscalCode: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckStatusEnumApi.ELIGIBLE
};

const aFailureDomainObject: EligibilityCheckFailure = {
  error: EligibilityCheckErrorEnum.INTERNAL_ERROR,
  errorDescription: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString
};

describe("EligibilityCheckFromApiObject", () => {
  it("should decode a success api object", () => {
    const result = EligibilityCheckFromApiObject.decode(aSuccessApiObject);
    if (isRight(result)) {
      expect(EligibilityCheck.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it("should decode a failure api object", () => {
    const result = EligibilityCheckFromApiObject.decode(aFailureApiObject);
    if (isRight(result)) {
      expect(EligibilityCheck.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it("should not decode an invalid api object", () => {
    const apiObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = EligibilityCheckFromApiObject.decode(apiObject);
    if (isRight(result)) {
      fail("Invalid api object must not be decoded");
    }
  });

  it.each`
    name                    | apiObject
    ${"failure api object"} | ${aFailureApiObject}
    ${"success api object"} | ${aSuccessApiObject}
  `("should reverse on $name", ({ apiObject }) => {
    EligibilityCheckFromApiObject.decode(apiObject)
      .chain(obj => EligibilityCheckToApiObject.decode(obj))
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

describe("EligibilityCheckToApiObject", () => {
  it("should decode a success domain object", () => {
    const result = EligibilityCheckToApiObject.decode(aSuccessDomainObject);
    if (isRight(result)) {
      expect(EligibilityCheckApi.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it("should decode a failure domain object", () => {
    const result = EligibilityCheckToApiObject.decode(aFailureDomainObject);
    if (isRight(result)) {
      expect(EligibilityCheckApi.is(result.value)).toBeTruthy();
    } else {
      fail("Valid api object must be decoded");
    }
  });

  it("should not decode an invalid domain object", () => {
    const invalidDomainObject = {};
    // @ts-ignore needed to test an unrepresentable type assignment
    const result = EligibilityCheckToApiObject.decode(invalidDomainObject);
    if (isRight(result)) {
      fail("Invalid domain object must not be decoded");
    }
  });

  it.each`
    name                       | apiObject
    ${"failure domain object"} | ${aFailureDomainObject}
    ${"success domain object"} | ${aSuccessDomainObject}
  `("should reverse on $name", ({ apiObject }) => {
    EligibilityCheckToApiObject.decode(apiObject)
      .chain(obj => EligibilityCheckFromApiObject.decode(obj))
      .fold(
        _ => {
          fail("Valid domain object must be decoded");
        },
        value => {
          expect(value).toEqual(apiObject);
        }
      );
  });
});
