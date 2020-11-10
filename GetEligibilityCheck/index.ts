import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { cosmosClient } from "../services/cosmosdb";
import { GetEligibilityCheck } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const eligibilityCheckContainer = cosmosClient
  .database(cosmosDbName)
  .container(ELIGIBILITY_CHECK_COLLECTION_NAME);

const eligibilityCheckModel = new EligibilityCheckModel(
  eligibilityCheckContainer
);

// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.get(
  "/api/v1/bonus/vacanze/eligibility/:fiscalcode",
  GetEligibilityCheck(eligibilityCheckModel)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
