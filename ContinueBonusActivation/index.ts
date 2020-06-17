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
import { documentClient } from "../utils/cosmosdb";
import { ContinueBonusActivation } from "./handler";

// Setup Express
const app = express();
secureExpressApp(app);

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const bonusActivationCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  BONUS_ACTIVATION_COLLECTION_NAME
);

const bonusActivationModel = new BonusActivationModel(
  documentClient,
  bonusActivationCollectionUrl
);

const isBonusActivationEnabled =
  getRequiredStringEnv("FF_BONUS_ACTIVATION_ENABLED") === "1";

// Add express route
app.put(
  "/api/v1/bonus/vacanze/activations/{fiscalcode}/{bonus_id}",
  ContinueBonusActivation(bonusActivationModel, isBonusActivationEnabled)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
