import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { documentClient } from "../utils/cosmosdb";
import { getUpsertEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const eligibilityChecksCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  ELIGIBILITY_CHECK_COLLECTION_NAME
);

const eligibilityCheckModel = new EligibilityCheckModel(
  documentClient,
  eligibilityChecksCollectionUrl
);

const UpsertEligibilityCheckActivity = getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel
);

export default UpsertEligibilityCheckActivity;
