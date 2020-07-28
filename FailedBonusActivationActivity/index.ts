import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { cosmosClient } from "../services/cosmosdb";
import { FailedBonusActivationHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const eligibilityCheckContainer = cosmosClient
  .database(cosmosDbName)
  .container(ELIGIBILITY_CHECK_COLLECTION_NAME);

const bonusActivationContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_ACTIVATION_COLLECTION_NAME);

const eligibilityCheckModel = new EligibilityCheckModel(
  eligibilityCheckContainer
);

const bonusActivationModel = new BonusActivationModel(bonusActivationContainer);

const FailedBonusActivation = FailedBonusActivationHandler(
  bonusActivationModel,
  eligibilityCheckModel
);

export default FailedBonusActivation;
