/**
 * Get a bonus activation in status = PROCESSING for the tuple (bonusId, fiscalCode)
 */
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import { cosmosClient } from "../services/cosmosdb";
import { getGetBonusActivationActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");
const bonusActivationContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_ACTIVATION_COLLECTION_NAME);

const bonusActivationModel = new BonusActivationModel(bonusActivationContainer);

const GetBonusActivationActivity = getGetBonusActivationActivityHandler(
  bonusActivationModel
);

export default GetBonusActivationActivity;
