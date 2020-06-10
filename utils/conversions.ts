/**
 * Map API objects to domain objects
 */

import { rights } from "fp-ts/lib/Array";
import { Either } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { BonusVacanzaBase as ApiBonusVacanzaBase } from "../generated/ade/BonusVacanzaBase";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import {
  ConsultazioneSogliaIndicatoreResponse,
  EsitoEnum
} from "../generated/definitions/ConsultazioneSogliaIndicatoreResponse";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import {
  EligibilityCheckFailure,
  ErrorEnum
} from "../generated/definitions/EligibilityCheckFailure";
import {
  EligibilityCheckSuccessEligible,
  StatusEnum as EligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessEligible";
import {
  EligibilityCheckSuccessIneligible,
  StatusEnum as IneligibleStatus
} from "../generated/definitions/EligibilityCheckSuccessIneligible";
import { FamilyMember } from "../generated/definitions/FamilyMember";
import { FamilyMembers } from "../generated/definitions/FamilyMembers";
import { MaxBonusAmount } from "../generated/definitions/MaxBonusAmount";
import { MaxBonusTaxBenefit } from "../generated/definitions/MaxBonusTaxBenefit";
import { SiNoTypeEnum } from "../generated/definitions/SiNoType";
import { Timestamp } from "../generated/definitions/Timestamp";
import { BonusActivation } from "../generated/models/BonusActivation";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import { renameObjectKeys } from "./rename_keys";
import { camelCaseToSnakeCase, snakeCaseToCamelCase } from "./strings";

/**
 * Maps EligibilityCheck API object into an EligibilityCheck domain object
 */
export const toModelEligibilityCheck = (
  apiObj: ApiEligibilityCheck
): Either<t.Errors, EligibilityCheck> => {
  const camelCasedUntypedObj = renameObjectKeys(apiObj, k =>
    snakeCaseToCamelCase(k)
  );
  return EligibilityCheck.decode(camelCasedUntypedObj);
};

/**
 * Maps EligibilityCheck API object into an EligibilityCheck domain object
 */
export const toApiEligibilityCheck = (
  domainObj: EligibilityCheck
): Either<t.Errors, ApiEligibilityCheck> => {
  const snakeCasedUntypedObj = renameObjectKeys(domainObj, k =>
    camelCaseToSnakeCase(k)
  );
  return ApiEligibilityCheck.decode(snakeCasedUntypedObj);
};

/**
 * Maps BonusActivation API object into an BonusActivation domain object
 */
export const toModelBonusActivation = (
  apiObj: ApiBonusActivation
): Either<t.Errors, BonusActivation> => {
  const camelCasedUntypedObj = renameObjectKeys(apiObj, k =>
    snakeCaseToCamelCase(k)
  );
  return BonusActivation.decode(camelCasedUntypedObj);
};

/**
 * Maps BonusActivation API object into an BonusActivation domain object
 */
export const toApiBonusActivation = (
  domainObj: BonusActivation
): Either<t.Errors, ApiBonusActivation> => {
  const snakeCasedUntypedObj = renameObjectKeys(domainObj, k =>
    camelCaseToSnakeCase(k)
  );
  return ApiBonusActivation.decode(snakeCasedUntypedObj);
};

/**
 * Maps BonusActivation domain object into an ADE BonusVacanzaBase API object
 */
export const toApiBonusVacanzaBase = (
  domainObject: BonusActivation
): Either<t.Errors, ApiBonusVacanzaBase> => {
  return ApiBonusVacanzaBase.decode({
    codiceBuono: domainObject.code,
    codiceFiscaleDichiarante: domainObject.applicantFiscalCode,
    dataGenerazione: domainObject.updatedAt.toISOString(),
    flagDifformitaIsee: domainObject.dsuRequest.hasDiscrepancies ? 1 : 0,
    importoMassimo: domainObject.dsuRequest.maxAmount,
    nucleoFamiliare: domainObject.dsuRequest.familyMembers.map(_ => ({
      codiceFiscale: _.fiscalCode
    }))
  });
};

function calculateMaxBonusAmount(
  numberOfFamilyMembers: number
): MaxBonusAmount {
  return (numberOfFamilyMembers > 2
    ? 500
    : numberOfFamilyMembers === 2
    ? 250
    : numberOfFamilyMembers === 1
    ? 150
    : 0) as MaxBonusAmount;
}

function calculateMaxBonusTaxBenefit(
  maxBonusAmount: MaxBonusAmount
): MaxBonusTaxBenefit {
  return (maxBonusAmount / 5) as MaxBonusTaxBenefit;
}

export const toEligibilityCheckFromDSU = (
  data: ConsultazioneSogliaIndicatoreResponse,
  fiscalCode: FiscalCode,
  validBefore: Timestamp
): ApiEligibilityCheck => {
  const bonusValue = calculateMaxBonusAmount(
    data.DatiIndicatore?.Componenti ? data.DatiIndicatore.Componenti.length : 0
  );

  const familyMembers: FamilyMembers = data.DatiIndicatore?.Componenti
    ? rights(
        data.DatiIndicatore.Componenti.map(c =>
          FamilyMember.decode({
            fiscal_code: c.CodiceFiscale,
            name: c.Nome,
            surname: c.Cognome
          })
        )
      )
    : [];

  if (data.Esito !== EsitoEnum.OK) {
    return EligibilityCheckFailure.encode({
      error:
        data.Esito === EsitoEnum.DATI_NON_TROVATI
          ? ErrorEnum.DATA_NOT_FOUND
          : data.Esito === EsitoEnum.RICHIESTA_INVALIDA
          ? ErrorEnum.INVALID_REQUEST
          : ErrorEnum.INTERNAL_ERROR,
      error_description: data.DescrizioneErrore || "Esito value is not OK",
      id: (fiscalCode as unknown) as NonEmptyString
    });
  }

  if (data.DatiIndicatore?.SottoSoglia === SiNoTypeEnum.SI) {
    return (EligibilityCheckSuccessEligible.encode({
      dsu_created_at: data.DatiIndicatore.DataPresentazioneDSU,
      dsu_protocol_id: (data.DatiIndicatore.ProtocolloDSU ||
        "") as NonEmptyString,
      family_members: familyMembers,
      has_discrepancies:
        data.DatiIndicatore.PresenzaDifformita === SiNoTypeEnum.SI,
      id: (fiscalCode as unknown) as NonEmptyString,
      isee_type: data.DatiIndicatore.TipoIndicatore,
      max_amount: bonusValue,
      max_tax_benefit: calculateMaxBonusTaxBenefit(bonusValue),
      // tslint:disable-next-line: no-useless-cast
      request_id: data.IdRichiesta.toString() as NonEmptyString,
      status: EligibleStatus.ELIGIBLE,
      valid_before: validBefore
    }) as unknown) as EligibilityCheckSuccessEligible;
  } else {
    return EligibilityCheckSuccessIneligible.encode({
      id: (fiscalCode as unknown) as NonEmptyString,
      status: IneligibleStatus.INELIGIBLE
    });
  }
};
