import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import {
  USER_BONUS_COLLECTION_NAME,
  UserBonusModel
} from "../models/user_bonus";
import { cosmosClient } from "../services/cosmosdb";
import { SuccessBonusActivationHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const bonusActivationContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_ACTIVATION_COLLECTION_NAME);

const userBonusContainer = cosmosClient
  .database(cosmosDbName)
  .container(USER_BONUS_COLLECTION_NAME);

const bonusActivationModel = new BonusActivationModel(bonusActivationContainer);

const userBonusModel = new UserBonusModel(userBonusContainer);

const SuccessBonusActivation = SuccessBonusActivationHandler(
  bonusActivationModel,
  userBonusModel
);

export default SuccessBonusActivation;
