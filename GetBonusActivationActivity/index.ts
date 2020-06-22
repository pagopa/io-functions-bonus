import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import { documentClient } from "../services/cosmosdb";
import { getGetBonusActivationActivityHandler } from "./handler";

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

const GetBonusActivationActivity = getGetBonusActivationActivityHandler(
  bonusActivationModel
);

export default GetBonusActivationActivity;
