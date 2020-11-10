import { FiscalCode } from "italia-ts-commons/lib/strings";

import { CosmosErrors } from "io-functions-commons/dist/src/utils/cosmosdb_model";
import { BonusCode } from "../generated/models/BonusCode";

export const makeBonusActivationResourceUri = (
  fiscalcode: FiscalCode,
  bonusId: BonusCode
) => `/bonus/vacanze/activations/${fiscalcode}/${bonusId}`;

export const errorToCosmosErrors = (err: Error): CosmosErrors => ({
  error: {
    body: {
      code: "error",
      message: err.message
    },
    message: err.message,
    name: "Error to CosmosErrors"
  },
  kind: "COSMOS_ERROR_RESPONSE"
});
