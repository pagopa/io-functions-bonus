/**
 * Map API objects to domain objects
 */

import { Either, left } from "fp-ts/lib/Either";
import * as t from "io-ts";
import { BonusVacanzaBase as ApiBonusVacanzaBase } from "../generated/ade/BonusVacanzaBase";
import { NucleoFamiliareElem as ApiNucleoFamiliareElem } from "../generated/ade/NucleoFamiliareElem";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { BonusActivation } from "../generated/models/BonusActivation";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import { FamilyMember } from "../generated/models/FamilyMember";
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
 * Maps FamilyMember domain object into NucleoFamiliareElem API object
 */
export const toApiNucleoFamiliareElem = (
  familyMember: FamilyMember
): Either<t.Errors, ApiNucleoFamiliareElem> => {
  return ApiNucleoFamiliareElem.decode({
    codiceFiscale: familyMember.fiscalCode
  });
};

/**
 * Maps BonusActivation domain object into an BonusVacanzaBase API object
 */
export const toApiBonusVacanzaBase = (
  domainObject: BonusActivation
): Either<t.Errors, ApiBonusVacanzaBase> => {
  try {
    const {
      code,
      applicantFiscalCode,
      updatedAt,
      dsuRequest: { maxAmount, familyMembers, hasDiscrepancies }
    } = domainObject;
    return ApiBonusVacanzaBase.decode({
      codiceBuono: code,
      codiceFiscaleDichiarante: applicantFiscalCode,
      dataGenerazione: updatedAt.toISOString(),
      flagDifformitaIsee: hasDiscrepancies ? 1 : 0,
      importoMassimo: maxAmount,
      nucleoFamiliare: familyMembers.map(toApiNucleoFamiliareElem)
    });
  } catch (err) {
    // destructuring may fail
    return left([{ message: err.message }] as t.Errors);
  }
};
