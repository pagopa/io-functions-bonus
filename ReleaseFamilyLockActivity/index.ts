import {
  getCollectionUri,
  getDatabaseUri
} from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import {
  BONUS_LEASE_COLLECTION_NAME,
  BonusLeaseModel
} from "../models/bonus_lease";
import { documentClient } from "../services/cosmosdb";
import { getReleaseFamilyLockActivityHandler } from "./handler";

const cosmosDbName = getRequiredStringEnv("COSMOSDB_BONUS_DATABASE_NAME");

const documentDbDatabaseUrl = getDatabaseUri(cosmosDbName);
const bonusLeaseModel = new BonusLeaseModel(
  documentClient,
  getCollectionUri(documentDbDatabaseUrl, BONUS_LEASE_COLLECTION_NAME)
);

const releaseFamilyLockActivityHandler = getReleaseFamilyLockActivityHandler(
  bonusLeaseModel
);

export default releaseFamilyLockActivityHandler;
