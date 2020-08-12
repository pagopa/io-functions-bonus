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
  EligibilityCheckSuccessConflict,
  StatusEnum as EligibilityCheckSuccessConflictStatus
} from "../generated/models/EligibilityCheckSuccessConflict";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibilityCheckSuccessEligibleStatus
} from "../generated/models/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as EligibilityCheckSuccessIneligibleStatus
} from "../generated/models/EligibilityCheckSuccessIneligible";

import { MessageContent } from "io-functions-commons/dist/generated/definitions/MessageContent";
import { QueryError } from "io-functions-commons/dist/src/utils/documentdb";
import { readableReport } from "italia-ts-commons/lib/reporters";
import {
  BonusVacanzaInvalidRequestError,
  BonusVacanzaTransientError
} from "../clients/adeClient";
import { BonusVacanzaBase } from "../generated/ade/BonusVacanzaBase";
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
import {
  BonusProcessing,
  RetrievedBonusProcessing
} from "../models/bonus_processing";
import { RetrievedUserBonus, UserBonus } from "../models/user_bonus";
import {
  BonusProcessing,
  RetrievedBonusProcessing
} from "../models/bonus_processing";

export const aFiscalCode = "AAABBB80A01C123D" as FiscalCode;
export const anotherFiscalCode = "CCCDDD80A01C123D" as FiscalCode;
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
      fiscalCode: anotherFiscalCode,
      name: "Chiara" as NonEmptyString,
      surname: "Bianchi" as NonEmptyString
    }
  ],
  hasDiscrepancies: false,
  iseeType: "iseeType",
  maxAmount: 300,
  maxTaxBenefit: 60,
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

export const aEligibilityCheckSuccessConflict: EligibilityCheckSuccessConflict = {
  dsuRequest: aDsu,
  id: (aFiscalCode as unknown) as NonEmptyString,
  status: EligibilityCheckSuccessConflictStatus.CONFLICT
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

  dsuRequest: aDsu
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

export const aBonusProcessing = BonusProcessing.decode({
  bonusId: aBonusId,
  id: aFiscalCode
}).getOrElseL(_ => {
  throw new Error(
    `Cannot create mock for BonusProcessing: ${readableReport(_)}`
  );
});

export const aRetrievedBonusProcessing = RetrievedBonusProcessing.decode({
  ...aBonusProcessing,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedBonusProcessing"
}).getOrElseL(_ => {
  throw new Error(
    `Cannot create mock for RetrievedBonusProcessing: ${readableReport(_)}`
  );
});

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

export const aUserBonus: UserBonus = {
  bonusId: aBonusId,
  fiscalCode: aFiscalCode,
  isApplicant: true
};

export const aRetrievedUserBonus: RetrievedUserBonus = {
  ...aUserBonus,
  _self: "xyz",
  _ts: 123,
  id: (aUserBonus.bonusId as unknown) as NonEmptyString,
  kind: "IRetrievedUserBonus"
};

export const aBonusVacanzaBase: BonusVacanzaBase = {
  codiceBuono: "ACEFGHLMNPRU",
  codiceFiscaleDichiarante: "AAAAAA55A55A555A",
  dataGenerazione: new Date("2020-06-11T08:54:31.143Z"),
  flagDifformita: 1,
  importoMassimo: 500,
  mac: "123",
  nucleoFamiliare: [
    {
      codiceFiscale: "AAAAAA55A55A555A"
    },
    {
      codiceFiscale: "BBBBBB88B88B888B"
    },
    {
      codiceFiscale: "CCCCCC99C99C999C"
    }
  ]
};

export const aBonusVacanzaInvalidRequestError: BonusVacanzaInvalidRequestError = {
  errorCode: "1000",
  errorMessage: "lorem ipsum"
};
export const aBonusVacanzaTransientError: BonusVacanzaTransientError = {
  errorCode: "3000",
  errorMessage: "Generic Error"
};

export const aGenericQueryError: QueryError = {
  body: "generic error",
  code: "error"
};

export const aNotFoundQueryError: QueryError = {
  body: "Not Found",
  code: 404
};

export const aConflictQueryError: QueryError = {
  body: "Conflict",
  code: 409
};

export const aMessageContent = MessageContent.decode({
  due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 /* +3gg */),
  markdown:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eu dolor nec metus.",
  payment_data: {
    amount: 100,
    invalid_after_due_date: true,
    notice_number: "012345678901234567"
  },
  prescription_data: {
    nre: "Lorem ipsum et."
  },
  subject: "a fake subject"
}).getOrElseL(e => {
  throw new Error(readableReport(e));
});

export const aBonusProcessing = BonusProcessing.decode({
  bonusId: aBonusId,
  id: aFiscalCode
}).getOrElseL(_ => {
  throw new Error(
    `Cannot create mock for BonusProcessing: ${readableReport(_)}`
  );
});

export const aRetrievedBonusProcessing = RetrievedBonusProcessing.decode({
  ...aBonusProcessing,
  _self: "xyz",
  _ts: 123,
  kind: "IRetrievedBonusProcessing"
}).getOrElseL(_ => {
  throw new Error(
    `Cannot create mock for RetrievedBonusProcessing: ${readableReport(_)}`
  );
});
