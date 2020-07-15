import { AzureFunction, Context } from "@azure/functions";
import * as express from "express";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { documentClient } from "../services/cosmosdb";
import { EligibilityCheck } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const eligibilityCheckCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  ELIGIBILITY_CHECK_COLLECTION_NAME
);

const eligibilityCheckModel = new EligibilityCheckModel(
  documentClient,
  eligibilityCheckCollectionUrl
);
// Setup Express
const app = express();
secureExpressApp(app);

// Add express route
app.post(
  "/api/v1/bonus/vacanze/eligibility/:fiscalcode",
  EligibilityCheck(eligibilityCheckModel)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
