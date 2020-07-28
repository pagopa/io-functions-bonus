import { CosmosClient } from "@azure/cosmos";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  ELIGIBILITY_CHECK_COLLECTION_NAME,
  EligibilityCheckModel
} from "../models/eligibility_check";
import { cosmosClient } from "../services/cosmosdb";
import { getDeleteEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");
const eligibilityCheckContainer = cosmosClient
  .database(cosmosDbName)
  .container(ELIGIBILITY_CHECK_COLLECTION_NAME);

const eligibilityCheckModel = new EligibilityCheckModel(
  eligibilityCheckContainer
);

const deleteEligibilityCheckActivityHandler = getDeleteEligibilityCheckActivityHandler(
  eligibilityCheckModel
);
export default deleteEligibilityCheckActivityHandler;
