import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_PROCESSING_COLLECTION_NAME,
  BonusProcessingModel
} from "../models/bonus_processing";
import { cosmosClient } from "../services/cosmosdb";
import { getReleaseUserLockActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const bonusProcessingContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_PROCESSING_COLLECTION_NAME);

const bonusProcessingModel = new BonusProcessingModel(bonusProcessingContainer);

const releaseUserLockActivityHandler = getReleaseUserLockActivityHandler(
  bonusProcessingModel
);

export default releaseUserLockActivityHandler;
