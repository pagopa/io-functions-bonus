import { QueryError } from "io-functions-commons/dist/src/utils/documentdb";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { BonusCode } from "../generated/models/BonusCode";

export const makeBonusActivationResourceUri = (
  fiscalcode: FiscalCode,
  bonusId: BonusCode
) => `/bonus/vacanze/activations/${fiscalcode}/${bonusId}`;

export const errorToQueryError = (err: Error): QueryError => ({
  body: err.message,
  code: "error"
});
