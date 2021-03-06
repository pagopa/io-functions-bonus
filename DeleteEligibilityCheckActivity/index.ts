import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { documentClient } from "../services/cosmosdb";
import { getDeleteEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const eligibilityCheckCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  ELIGIBILITY_CHECK_COLLECTION_NAME
);

const eligibilityCheckModel = new EligibilityCheckModel(
  documentClient,
  eligibilityCheckCollectionUrl
);

const deleteEligibilityCheckActivityHandler = getDeleteEligibilityCheckActivityHandler(
  eligibilityCheckModel
);
export default deleteEligibilityCheckActivityHandler;
