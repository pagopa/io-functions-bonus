import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_ACTIVATION_COLLECTION_NAME,
  BonusActivationModel
} from "../models/bonus_activation";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { documentClient } from "../services/cosmosdb";
import { FailedBonusActivationHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const eligibilityCheckModel = new EligibilityCheckModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    ELIGIBILITY_CHECK_COLLECTION_NAME
  )
);

const bonusActivationModel = new BonusActivationModel(
  documentClient,
  documentDbUtils.getCollectionUri(
    documentDbDatabaseUrl,
    BONUS_ACTIVATION_COLLECTION_NAME
  )
);

const FailedBonusActivation = FailedBonusActivationHandler(
  bonusActivationModel,
  eligibilityCheckModel
);

export default FailedBonusActivation;
