import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  USER_BONUS_COLLECTION_NAME,
  UserBonusModel
} from "../models/user_bonus";
import { documentClient } from "../services/cosmosdb";
import { GetAllBonusActivations } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const userBonusCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  USER_BONUS_COLLECTION_NAME
);

const userBonusModel = new UserBonusModel(
  documentClient,
  userBonusCollectionUrl
);

// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.get(
  "/api/v1/bonus/vacanze/activations/:fiscalcode",
  GetAllBonusActivations(userBonusModel)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
