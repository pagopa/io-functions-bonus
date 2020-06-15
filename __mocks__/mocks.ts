import { IWithinRangeIntegerTag } from "italia-ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusActivation } from "../generated/models/BonusActivation";
import { BonusActivationStatusEnum } from "../generated/models/BonusActivationStatus";
import { BonusCode } from "../generated/models/BonusCode";
import { Dsu } from "../generated/models/Dsu";
import {
  EligibilityCheckFailure,
  ErrorEnum as EligibilityCheckFailureErrorEnum,
  StatusEnum as EligibilityCheckFailureStatusEnum
} from "../generated/models/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibilityCheckSuccessEligibleStatus
} from "../generated/models/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as EligibilityCheckSuccessIneligibleStatus
} from "../generated/models/EligibilityCheckSuccessIneligible";

import { BonusActivationWithFamilyUID } from "../generated/models/BonusActivationWithFamilyUID";
import { FamilyUID } from "../generated/models/FamilyUID";
import {
  NewBonusActivation,
  RetrievedBonusActivation
} from "../models/bonus_activation";
import {
  BonusLease,
  NewBonusLease,
  RetrievedBonusLease
} from "../models/bonus_lease";

export const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;
export const aFamilyUID = "aFamilyUid" as FamilyUID;

export const aDsu: Dsu = {
  dsuCreatedAt: new Date(),
  dsuProtocolId: "aDsuProtocolId" as NonEmptyString,
  familyMembers: [
    {
      fiscalCode: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    },
    {
      fiscalCode: "CCCDDD80A01C123D" as FiscalCode,
      name: "Chiara" as NonEmptyString,
      surname: "Bianchi" as NonEmptyString
    }
  ],
  hasDiscrepancies: false,
  iseeType: "iseeType",
  maxAmount: 250,
  maxTaxBenefit: 50,
  requestId: 123
};

export const aEligibilityCheckSuccessEligible: EligibilityCheckSuccessEligible = {
  dsuRequest: aDsu,
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessEligibleStatus.ELIGIBLE,
  validBefore: new Date()
};

export const aEligibilityCheckSuccessEligibleValid: EligibilityCheckSuccessEligible = {
  dsuRequest: aDsu,
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessEligibleStatus.ELIGIBLE,
  validBefore: new Date(Date.now() + 24 * 60 * 60 * 1000 /* +24h */)
};
export const aEligibilityCheckSuccessEligibleExpired: EligibilityCheckSuccessEligible = {
  dsuRequest: aDsu,
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessEligibleStatus.ELIGIBLE,
  validBefore: new Date(Date.now() - 1 * 60 * 60 * 1000 /* -1h */)
};

export const aEligibilityCheckSuccessIneligible: EligibilityCheckSuccessIneligible = {
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessIneligibleStatus.INELIGIBLE
};

export const aEligibilityCheckFailure: EligibilityCheckFailure = {
  error: EligibilityCheckFailureErrorEnum.INTERNAL_ERROR,
  errorDescription: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckFailureStatusEnum.FAILURE
};

export const aBonusId = "AAAAAAAAAAAA" as NonEmptyString & BonusCode;
export const aBonusActivationId = aBonusId;
export const aBonusActivation: BonusActivation = {
  id: "AAAAAAAAAAAA" as BonusCode,

  applicantFiscalCode: aFiscalCode,

  status: BonusActivationStatusEnum.ACTIVE,

  createdAt: new Date(),

  dsuRequest: {
    familyMembers: [
      {
        fiscalCode: aFiscalCode,
        name: "MARIO" as NonEmptyString,
        surname: "ROSSI" as NonEmptyString
      }
    ],

    maxAmount: (200 as unknown) as IWithinRangeIntegerTag<150, 501> & number,

    maxTaxBenefit: (100 as unknown) as IWithinRangeIntegerTag<30, 101> & number,

    requestId: 123,

    iseeType: "aISEEtype",

    dsuProtocolId: "aProtocolId" as NonEmptyString,

    dsuCreatedAt: new Date(),

    hasDiscrepancies: false
  }
};

export const aBonusActivationWithFamilyUID: BonusActivationWithFamilyUID = {
  ...aBonusActivation,
  familyUID: aFamilyUID
};

export const aRetrievedBonusActivation: RetrievedBonusActivation = {
  ...aBonusActivationWithFamilyUID,
  _self: "xyz",
  _ts: 123,
  id: aBonusActivationId,
  kind: "IRetrievedBonusActivation"
};

export const aNewBonusActivation: NewBonusActivation = {
  ...aBonusActivationWithFamilyUID,
  id: aBonusActivationId,
  kind: "INewBonusActivation"
};

export const aBonusLease: BonusLease = {
  id: aFamilyUID
};

export const aNewBonusLease: NewBonusLease = {
  ...aBonusLease,
  kind: "INewBonusLease"
};

export const aRetrievedBonusLease: RetrievedBonusLease = {
  ...aBonusLease,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedBonusLease"
};
