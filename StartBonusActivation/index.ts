import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { documentClient } from "../utils/cosmosdb";
import { StartBonusActivation } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const isBonusActivationEnabled =
  getRequiredStringEnv("FF_BONUS_ACTIVATION_ENABLED") === "1";

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const eligibilityCheckModel = new EligibilityCheckModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    ELIGIBILITY_CHECK_COLLECTION_NAME
  )
);

const bonusActivationModel = new BonusActivationModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_ACTIVATION_COLLECTION_NAME
  )
);

const bonusLeaseModel = new BonusLeaseModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_LEASE_COLLECTION_NAME
  )
);

// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.post(
  "/api/v1/bonus/vacanze/activations/:fiscalcode",
  StartBonusActivation(
    bonusActivationModel,
    bonusLeaseModel,
    eligibilityCheckModel,
    isBonusActivationEnabled
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
