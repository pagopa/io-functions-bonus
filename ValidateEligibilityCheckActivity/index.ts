import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import { cosmosClient } from "../services/cosmosdb";
import { getValidateEligibilityCheckActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");
const bonusLeaseContainer = cosmosClient
  .database(cosmosDbName)
  .container(BONUS_LEASE_COLLECTION_NAME);

const bonusLeaseModel = new BonusLeaseModel(bonusLeaseContainer);

const ValidateEligibilityCheckActivity = getValidateEligibilityCheckActivityHandler(
  bonusLeaseModel
);

export default ValidateEligibilityCheckActivity;
