import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  USER_BONUS_COLLECTION_NAME,
  UserBonusModel
} from "../models/user_bonus";
import { cosmosClient } from "../services/cosmosdb";
import { GetAllBonusActivations } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const userBonusContainer = cosmosClient
  .database(cosmosDbName)
  .container(USER_BONUS_COLLECTION_NAME);

const userBonusModel = new UserBonusModel(userBonusContainer);

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
