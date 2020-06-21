import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import {
  USER_BONUS_COLLECTION_NAME,
  UserBonusModel
} from "../models/user_bonus";
import { documentClient } from "../services/cosmosdb";
import { SuccessBonusActivationHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const bonusActivationModel = new BonusActivationModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_ACTIVATION_COLLECTION_NAME
  )
);

const userBonusModel = new UserBonusModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    USER_BONUS_COLLECTION_NAME
  )
);

const SuccessBonusActivation = SuccessBonusActivationHandler(
  bonusActivationModel,
  userBonusModel
);

export default SuccessBonusActivation;
