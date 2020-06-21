import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import { documentClient } from "../services/cosmosdb";
import { getValidateEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const bonusLeaseCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  BONUS_LEASE_COLLECTION_NAME
);

const bonusLeaseModel = new BonusLeaseModel(
  documentClient,
  bonusLeaseCollectionUrl
);

const ValidateEligibilityCheckActivity = getValidateEligibilityCheckActivityHandler(
  bonusLeaseModel
);

export default ValidateEligibilityCheckActivity;
