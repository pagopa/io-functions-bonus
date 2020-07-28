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
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import {
  BONUS_PROCESSING_COLLECTION_NAME,
  BonusProcessingModel
} from "../models/bonus_processing";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { cosmosClient } from "../services/cosmosdb";
import { BONUS_ACTIVATIONS_QUEUE_NAME, queueService } from "../services/queue";
import { StartBonusActivation } from "./handler";
import { getEnqueueBonusActivation } from "./models";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const eligibilityCheckContainer = cosmosClient
  .database(cosmosDbName)
  .container(ELIGIBILITY_CHECK_COLLECTION_NAME);

const bonusActivationContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_ACTIVATION_COLLECTION_NAME);

const bonusLeaseContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_LEASE_COLLECTION_NAME);

const eligibilityCheckModel = new EligibilityCheckModel(
  eligibilityCheckContainer
);

const bonusActivationModel = new BonusActivationModel(bonusActivationContainer);

const bonusLeaseModel = new BonusLeaseModel(bonusLeaseContainer);

const bonusProcessingModel = new BonusProcessingModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_PROCESSING_COLLECTION_NAME
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
    bonusProcessingModel,
    eligibilityCheckModel,
    getEnqueueBonusActivation(queueService, BONUS_ACTIVATIONS_QUEUE_NAME)
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

const httpStart: AzureFunction = (context: Context): void => {
  setAppContext(app, context);
  azureFunctionHandler(context);
};

export default httpStart;
