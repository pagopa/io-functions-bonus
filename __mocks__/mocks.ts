import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
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
import { MaxBonusAmount } from "../generated/models/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../generated/models/MaxBonusTaxBenefit";

export const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;

export const aDsu: Dsu = {
  dsuCreatedAt: new Date(),
  dsuProtocolId: "aDsuProtocolId" as NonEmptyString,
  familyMembers: [
    {
      fiscalCode: aFiscalCode,
      name: "Mario" as NonEmptyString,
      surname: "Rossi" as NonEmptyString
    }
  ],
  hasDiscrepancies: false,
  iseeType: "iseeType",
  maxAmount: 200 as MaxBonusAmount,
  maxTaxBenefit: 80 as MaxBonusTaxBenefit,
  requestId: "aRequestId" as NonEmptyString
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

export const aEligibilityCheckFailure: EligibilityCheckFailure = {
  error: EligibilityCheckFailureErrorEnum.INTERNAL_ERROR,
  errorDescription: "lorem ipsum",
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckFailureStatusEnum.FAILURE
};
