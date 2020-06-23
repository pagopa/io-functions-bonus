import {
  getCollectionUri,
  getDatabaseUri
} from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_PROCESSING_COLLECTION_NAME,
  BonusProcessingModel
} from "../models/bonus_processing";
import { documentClient } from "../services/cosmosdb";
import { getReleaseUserLockActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = getDatabaseUri(cosmosDbName);
const bonusProcessingModel = new BonusProcessingModel(
  documentClient,
  getCollectionUri(documentDbDatabaseUrl, BONUS_PROCESSING_COLLECTION_NAME)
);

const releaseUserLockActivityHandler = getReleaseUserLockActivityHandler(
  bonusProcessingModel
);

export default releaseUserLockActivityHandler;
