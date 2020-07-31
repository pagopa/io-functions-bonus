import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { cosmosClient } from "../services/cosmosdb";
import { getUpsertEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const eligibilityCheckContainer = cosmosClient
  .database(cosmosDbName)
  .container(ELIGIBILITY_CHECK_COLLECTION_NAME);

const eligibilityCheckModel = new EligibilityCheckModel(
  eligibilityCheckContainer
);

const UpsertEligibilityCheckActivity = getUpsertEligibilityCheckActivityHandler(
  eligibilityCheckModel
);

export default UpsertEligibilityCheckActivity;
