/**
 * Map API objects to domain objects
 */

import { Either } from "fp-ts/lib/Either";
import { Errors } from "io-ts";
import { BonusActivation as ApiBonusActivation } from "../generated/definitions/BonusActivation";
import { EligibilityCheck as ApiEligibilityCheck } from "../generated/definitions/EligibilityCheck";
import { BonusActivation } from "../generated/models/BonusActivation";
import { EligibilityCheck } from "../generated/models/EligibilityCheck";
import { renameObjectKeys } from "./rename_keys";
import { camelCaseToSnakeCase, snakeCaseToCamelCase } from "./strings";

/**
 * Maps EligibilityCheck API object into an EligibilityCheck domain object
 */
export const toModelEligibilityCheck = (
  apiObj: ApiEligibilityCheck
): Either<Errors, EligibilityCheck> => {
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
): Either<Errors, ApiEligibilityCheck> => {
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
): Either<Errors, BonusActivation> => {
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
): Either<Errors, ApiBonusActivation> => {
  const snakeCasedUntypedObj = renameObjectKeys(domainObj, k =>
    camelCaseToSnakeCase(k)
  );
  return ApiBonusActivation.decode(snakeCasedUntypedObj);
};
