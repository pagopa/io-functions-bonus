import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import { cosmosClient } from "../services/cosmosdb";
import { GetBonusActivation } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const bonusActivationContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_ACTIVATION_COLLECTION_NAME);

const bonusActivationModel = new BonusActivationModel(bonusActivationContainer);

// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.get(
  "/api/v1/bonus/vacanze/activations/:fiscalcode/:bonus_id",
  GetBonusActivation(bonusActivationModel)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
